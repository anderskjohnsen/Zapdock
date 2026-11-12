# Zapdock hjelpeprosess for Windows.
# - "Spilles nå" fra Windows sine mediekontroller (Spotify, nettlesere, VLC, osv.)
# - Hovedvolum og demping (Core Audio)
# Skriver JSON-linjer til stdout og leser kommandoer fra stdin.
#   media toggle|next|prev|play|pause
#   media prefer <app-id-del>      (f.eks. Spotify)
#   audio set <0..1> | audio mute | audio unmute | audio togglemute

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
  int f(); int g(); int h(); int i();
  int SetMasterVolumeLevelScalar(float fLevel, Guid pguidEventContext);
  int j();
  int GetMasterVolumeLevelScalar(out float pfLevel);
  int k(); int l(); int m(); int n();
  int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, Guid pguidEventContext);
  int GetMute(out bool pbMute);
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
  int Activate(ref Guid id, int clsCtx, int activationParams, out IAudioEndpointVolume aev);
}
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
  int f();
  int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
}
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorComObject { }

// Leser stdin på en egen tråd: Console.In.ReadLineAsync blokkerer i Windows PowerShell.
public static class ZapdockInput {
  static readonly System.Collections.Concurrent.ConcurrentQueue<string> queue = new System.Collections.Concurrent.ConcurrentQueue<string>();
  static volatile bool closed = false;
  public static void Start() {
    var t = new System.Threading.Thread(() => {
      try {
        string line;
        while ((line = Console.In.ReadLine()) != null) queue.Enqueue(line);
      } catch { }
      closed = true;
    });
    t.IsBackground = true;
    t.Start();
  }
  public static string Next() { string l; return queue.TryDequeue(out l) ? l : null; }
  public static bool Closed { get { return closed && queue.IsEmpty; } }
}

public class ZapdockAudio {
  static IAudioEndpointVolume Vol() {
    var enumerator = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
    IMMDevice dev = null;
    Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(0, 1, out dev));
    IAudioEndpointVolume epv = null;
    var epvid = typeof(IAudioEndpointVolume).GUID;
    Marshal.ThrowExceptionForHR(dev.Activate(ref epvid, 23, 0, out epv));
    return epv;
  }
  public static float Volume {
    get { float v = -1; Marshal.ThrowExceptionForHR(Vol().GetMasterVolumeLevelScalar(out v)); return v; }
    set { Marshal.ThrowExceptionForHR(Vol().SetMasterVolumeLevelScalar(value, Guid.Empty)); }
  }
  public static bool Mute {
    get { bool mute; Marshal.ThrowExceptionForHR(Vol().GetMute(out mute)); return mute; }
    set { Marshal.ThrowExceptionForHR(Vol().SetMute(value, Guid.Empty)); }
  }
}
"@

function Out-Json($obj) {
  [Console]::Out.WriteLine(($obj | ConvertTo-Json -Compress -Depth 4))
  [Console]::Out.Flush()
}

# ---------- WinRT-oppsett ----------
$mediaOk = $false
try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
      $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    })[0]
  function Await($op, [Type]$type) {
    $t = $asTaskGeneric.MakeGenericMethod($type).Invoke($null, @($op))
    if (-not $t.Wait(3000)) { return $null }
    return $t.Result
  }
  $null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
  $null = [Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType = WindowsRuntime]
  $mgrType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]
  $propsType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]
  $streamType = [Windows.Storage.Streams.IRandomAccessStreamWithContentType]
  $mgr = Await ($mgrType::RequestAsync()) $mgrType
  if ($mgr) { $mediaOk = $true }
} catch {
  Out-Json @{ type = 'error'; scope = 'media'; message = $_.Exception.Message }
}

$prefer = 'Spotify'
$lastMediaJson = ''
$lastAudioJson = ''
$lastTrackKey = ''
$artwork = $null

function Get-Session {
  if (-not $mediaOk) { return $null }
  $sessions = @($mgr.GetSessions())
  if ($prefer) {
    $p = $sessions | Where-Object { $_.SourceAppUserModelId -like "*$prefer*" } | Select-Object -First 1
    if ($p) {
      # Foretrukket app vinner hvis den spiller, eller hvis ingen andre spiller.
      $playing = $sessions | Where-Object { $_.GetPlaybackInfo().PlaybackStatus -eq 'Playing' } | Select-Object -First 1
      if ($p.GetPlaybackInfo().PlaybackStatus -eq 'Playing' -or -not $playing) { return $p }
      return $playing
    }
  }
  return $mgr.GetCurrentSession()
}

function Read-Artwork($props) {
  try {
    if (-not $props.Thumbnail) { return $null }
    $ras = Await ($props.Thumbnail.OpenReadAsync()) $streamType
    if (-not $ras) { return $null }
    $stream = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($ras)
    $ms = New-Object System.IO.MemoryStream
    $stream.CopyTo($ms)
    $stream.Dispose()
    $type = if ($ras.ContentType) { $ras.ContentType } else { 'image/png' }
    if ($ms.Length -gt 1500000) { return $null }
    return "data:$type;base64," + [Convert]::ToBase64String($ms.ToArray())
  } catch { return $null }
}

function Emit-Media([bool]$force = $false) {
  $s = $null
  try { $s = Get-Session } catch { }
  if (-not $s) {
    $obj = @{ type = 'media'; supported = $mediaOk; active = $false }
  } else {
    $props = $null
    try { $props = Await ($s.TryGetMediaPropertiesAsync()) $propsType } catch { }
    $pb = $s.GetPlaybackInfo()
    $tl = $s.GetTimelineProperties()
    $title = if ($props) { $props.Title } else { '' }
    $artist = if ($props) { $props.Artist } else { '' }
    $album = if ($props) { $props.AlbumTitle } else { '' }
    $key = "$($s.SourceAppUserModelId)|$title|$artist|$album"
    if ($key -ne $script:lastTrackKey) {
      $script:lastTrackKey = $key
      $script:artwork = if ($props) { Read-Artwork $props } else { $null }
    }
    $obj = [ordered]@{
      type = 'media'; supported = $true; active = $true
      app = $s.SourceAppUserModelId
      title = $title; artist = $artist; album = $album
      status = [string]$pb.PlaybackStatus
      canNext = $pb.Controls.IsNextEnabled; canPrev = $pb.Controls.IsPreviousEnabled
      position = [math]::Round($tl.Position.TotalSeconds, 1)
      duration = [math]::Round($tl.EndTime.TotalSeconds, 1)
      updatedAt = $tl.LastUpdatedTime.ToUnixTimeMilliseconds()
      artwork = $script:artwork
    }
  }
  $json = $obj | ConvertTo-Json -Compress -Depth 4
  # Posisjon endres hele tiden; send bare når noe annet endres (klienten interpolerer).
  $cmp = $json -replace '"position":[0-9.]+,?', '' -replace '"updatedAt":[0-9]+,?', ''
  if ($force -or $cmp -ne $script:lastMediaJson) {
    $script:lastMediaJson = $cmp
    [Console]::Out.WriteLine($json)
    [Console]::Out.Flush()
  }
}

function Emit-Audio {
  try {
    $obj = @{ type = 'audio'; volume = [math]::Round([ZapdockAudio]::Volume, 3); muted = [ZapdockAudio]::Mute }
  } catch {
    $obj = @{ type = 'audio'; volume = $null; muted = $false; error = $_.Exception.Message }
  }
  $json = $obj | ConvertTo-Json -Compress
  if ($json -ne $script:lastAudioJson) {
    $script:lastAudioJson = $json
    [Console]::Out.WriteLine($json)
    [Console]::Out.Flush()
  }
}

function Invoke-ZdCommand($line) {
  $parts = $line.Trim() -split '\s+', 3
  try {
    switch ($parts[0]) {
      'media' {
        if ($parts[1] -eq 'prefer') { $script:prefer = $parts[2]; $script:lastMediaJson = ''; return }
        $s = Get-Session
        if (-not $s) { return }
        switch ($parts[1]) {
          'toggle' { $null = Await ($s.TryTogglePlayPauseAsync()) ([bool]) }
          'play' { $null = Await ($s.TryPlayAsync()) ([bool]) }
          'pause' { $null = Await ($s.TryPauseAsync()) ([bool]) }
          'next' { $null = Await ($s.TrySkipNextAsync()) ([bool]) }
          'prev' { $null = Await ($s.TrySkipPreviousAsync()) ([bool]) }
        }
        Start-Sleep -Milliseconds 150
        Emit-Media
      }
      'audio' {
        switch ($parts[1]) {
          'set' { [ZapdockAudio]::Volume = [float]::Parse($parts[2], [System.Globalization.CultureInfo]::InvariantCulture); [ZapdockAudio]::Mute = $false }
          'mute' { [ZapdockAudio]::Mute = $true }
          'unmute' { [ZapdockAudio]::Mute = $false }
          'togglemute' { [ZapdockAudio]::Mute = -not [ZapdockAudio]::Mute }
        }
        Emit-Audio
      }
      'ping' { Out-Json @{ type = 'pong' } }
    }
  } catch {
    Out-Json @{ type = 'error'; scope = $parts[0]; message = $_.Exception.Message }
  }
}

Out-Json @{ type = 'ready'; media = $mediaOk }
[ZapdockInput]::Start()
$tick = 0
while ($true) {
  while ($null -ne ($line = [ZapdockInput]::Next())) {
    if ($line) { Invoke-ZdCommand $line }
  }
  if ([ZapdockInput]::Closed) { exit 0 } # stdin lukket: Zapdock er avsluttet
  try {
    if ($tick % 4 -eq 0) { Emit-Media ($tick % 40 -eq 0) }
    if ($tick % 2 -eq 0) { Emit-Audio }
  } catch {
    Out-Json @{ type = 'error'; scope = 'loop'; message = $_.Exception.Message }
  }
  $tick++
  Start-Sleep -Milliseconds 250
}
