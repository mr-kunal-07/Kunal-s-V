import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shiftDay, weekDates, isScheduled, occurrenceId, weeklyTotals } from '../src/daybook-utils.js'
test('day shifts handle year boundaries and leap days',()=>{assert.equal(shiftDay('2026-01-01',-1),'2025-12-31');assert.equal(shiftDay('2024-03-01',-1),'2024-02-29')})
test('week review uses Monday to Sunday including cross-month weeks',()=>{const days=weekDates('2026-11-01');assert.equal(days[0],'2026-10-26');assert.equal(days[6],'2026-11-01');assert.equal(new Set(days).size,7)})
test('recurrence respects start dates, selected weekdays and pause',()=>{const t={enabled:true,startDate:'2026-11-02',repeat:'weekdays',weekdays:[1,3]};assert.equal(isScheduled(t,'2026-11-02'),true);assert.equal(isScheduled(t,'2026-11-03'),false);assert.equal(isScheduled(t,'2026-10-28'),false);assert.equal(isScheduled({...t,enabled:false},'2026-11-02'),false);assert.equal(isScheduled({...t,repeat:'daily'},'2026-11-03'),true)})
test('recurrence IDs are deterministic and separate schedules and dates',()=>{assert.equal(occurrenceId('a','2026-11-02'),occurrenceId('a','2026-11-02'));assert.notEqual(occurrenceId('a','2026-11-02'),occurrenceId('b','2026-11-02'));assert.notEqual(occurrenceId('a','2026-11-02'),occurrenceId('a','2026-11-03'))})
test('weekly totals count done and pending, including empty days',()=>{assert.deepEqual(weeklyTotals([{date:'2026-11-02',done:true},{date:'2026-11-02',done:false}],['2026-11-02','2026-11-03']),[{date:'2026-11-02',total:2,done:1,pending:1},{date:'2026-11-03',total:0,done:0,pending:0}])})
