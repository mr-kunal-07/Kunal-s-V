import { test } from 'node:test'
import assert from 'node:assert/strict'
import { displayDay, monthDays } from '../src/calendar-utils.js'
test('display format never changes stored ISO date',()=>{assert.equal(displayDay('2020-11-16'),'16 Nov 2020')})
test('2020 calendar returns exact selected day and leap date',()=>{assert.deepEqual(monthDays(2020,10).find(d=>d.iso==='2020-11-16'),{iso:'2020-11-16',day:16,current:true});assert.ok(monthDays(2020,1).some(d=>d.iso==='2020-02-29'&&d.current));assert.equal(new Set(monthDays(2020,10).map(d=>d.iso)).size,42)})

