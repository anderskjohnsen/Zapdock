'use strict';
// Tester iCal-parseren. Kjøres med TZ=Europe/Oslo (settes i npm-skriptet).
process.env.TZ = 'Europe/Oslo';
const assert = require('assert');
const { parseIcs, expandEvents } = require('../src/main/lib/ics');

const ics = [
  'BEGIN:VCALENDAR',
  'BEGIN:VTIMEZONE', 'TZID:Europe/Oslo', 'BEGIN:STANDARD', 'DTSTART:19701025T030000', 'END:STANDARD', 'END:VTIMEZONE',
  // Ukentlig fotball tirsdag og torsdag 17:30 (Oslo), med ett unntak og én flyttet forekomst
  'BEGIN:VEVENT', 'UID:fotball', 'SUMMARY:Fotball Emma', 'LOCATION:Avaldsnes stadion',
  'DTSTART;TZID=Europe/Oslo:20261020T173000', 'DTEND;TZID=Europe/Oslo:20261020T183000',
  'RRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20261231T000000Z',
  'EXDATE;TZID=Europe/Oslo:20261112T173000',
  'BEGIN:VALARM', 'TRIGGER:-PT15M', 'SUMMARY:alarm skal ignoreres', 'END:VALARM',
  'END:VEVENT',
  'BEGIN:VEVENT', 'UID:fotball', 'SUMMARY:Fotball Emma (flyttet)', 'RECURRENCE-ID;TZID=Europe/Oslo:20261117T173000',
  'DTSTART;TZID=Europe/Oslo:20261117T190000', 'DTEND;TZID=Europe/Oslo:20261117T200000', 'END:VEVENT',
  // Heldag
  'BEGIN:VEVENT', 'UID:bursdag', 'SUMMARY:Tuva bursdag', 'DTSTART;VALUE=DATE:20261113', 'DTEND;VALUE=DATE:20261114',
  'RRULE:FREQ=YEARLY', 'END:VEVENT',
  // UTC-tid, lang linje som er brettet
  'BEGIN:VEVENT', 'UID:moete', 'SUMMARY:Foreldre', ' møte\\, 3. klasse', 'DTSTART:20261116T170000Z', 'DURATION:PT1H30M', 'END:VEVENT',
  // Avlyst
  'BEGIN:VEVENT', 'UID:avlyst', 'SUMMARY:Avlyst', 'STATUS:CANCELLED', 'DTSTART:20261116T100000Z', 'END:VEVENT',
  // Månedlig: andre tirsdag, Windows-tidssone
  'BEGIN:VEVENT', 'UID:fau', 'SUMMARY:FAU', 'DTSTART;TZID=W. Europe Standard Time:20260908T190000',
  'DTEND;TZID=W. Europe Standard Time:20260908T200000', 'RRULE:FREQ=MONTHLY;BYDAY=2TU;COUNT=6', 'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const events = parseIcs(ics);
assert.strictEqual(events.length, 6);
const from = new Date('2026-11-09T00:00:00+01:00').getTime();
const to = new Date('2026-11-23T00:00:00+01:00').getTime();
const list = expandEvents(events, from, to);
const fmt = (e) => `${new Date(e.start).toISOString()} ${e.summary}`;
const titles = list.map(fmt);

const fotball = list.filter((e) => e.uid === 'fotball');
// Tir 10, tor 12 (unntatt), tir 17 (flyttet til 19:00), tor 19 -> 10, 17(flyttet), 19
assert.deepStrictEqual(fotball.map((e) => new Date(e.start).toISOString()), [
  '2026-11-10T16:30:00.000Z', '2026-11-17T18:00:00.000Z', '2026-11-19T16:30:00.000Z',
], titles.join('\n'));
assert.strictEqual(fotball[1].summary, 'Fotball Emma (flyttet)');
assert.strictEqual(fotball[0].location, 'Avaldsnes stadion');

const bursdag = list.find((e) => e.uid === 'bursdag');
assert.ok(bursdag.allDay);
assert.strictEqual(bursdag.start, new Date(2026, 10, 13).getTime());

const moete = list.find((e) => e.uid === 'moete');
assert.strictEqual(moete.summary, 'Foreldremøte, 3. klasse');
assert.strictEqual(moete.end - moete.start, 90 * 60000);
assert.ok(!list.some((e) => e.uid === 'avlyst'));

const fau = list.find((e) => e.uid === 'fau');
assert.strictEqual(new Date(fau.start).toISOString(), '2026-11-10T18:00:00.000Z', 'andre tirsdag i november 19:00 CET');

// Sommertid: oktober-forekomst før skiftet er 15:30Z, etter er 16:30Z
const oct = expandEvents(events, new Date('2026-10-20T00:00:00Z').getTime(), new Date('2026-10-28T00:00:00Z').getTime())
  .filter((e) => e.uid === 'fotball').map((e) => new Date(e.start).toISOString());
assert.deepStrictEqual(oct, ['2026-10-20T15:30:00.000Z', '2026-10-22T15:30:00.000Z', '2026-10-27T16:30:00.000Z']);

console.log('ics: alle tester OK');
