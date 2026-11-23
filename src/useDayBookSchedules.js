import { useEffect, useState } from 'react'
import { onSnapshot } from 'firebase/firestore'
import { materialize, schedulesFor } from './daybook-service'
import { explainError } from './firebase'
import useOnline from './useOnline'

// Day Book generates deterministic occurrences for saved recurring schedules.
export default function useDayBookSchedules(uid, date) {
  const online = useOnline()
  const [state, setState] = useState({ templates: [], fromCache: true, error: '' })
  useEffect(() => onSnapshot(schedulesFor(uid), { includeMetadataChanges: true }, snapshot => {
    setState({ templates: snapshot.docs.map(entry => ({ id: entry.id, ...entry.data(), _pending: entry.metadata.hasPendingWrites })), fromCache: snapshot.metadata.fromCache, error: '' })
  }, error => setState(current => ({ ...current, error: explainError(error) }))), [uid])
  useEffect(() => {
    if (!online || state.fromCache) return
    let active = true
    materialize(uid, state.templates.filter(template => !template._pending), date).catch(error => {
      if (active) setState(current => ({ ...current, error: explainError(error) }))
    })
    return () => { active = false }
  }, [uid, date, state.templates, state.fromCache, online])
  return state
}
