import { useCallback, useEffect, useState } from 'react'
import { onSnapshot, query, where } from 'firebase/firestore'
import { tasksFor } from './daybook-service'
import { tasksForDay } from './daybook-utils'
import { explainError } from './firebase'

// The sidebar and Day Book share this subscription, including the selected date.
export default function useDayBookTasks(uid, date) {
  const key = `${uid}/${date}`
  const [state, setState] = useState({ key, tasks: [], loading: true, error: '' })
  useEffect(() => {
    let active = true
    setState({ key, tasks: [], loading: true, error: '' })
    const timer = setTimeout(() => {
      if (active) setState(current => ({ ...current, loading: false, error: 'Day Book is taking too long to connect. Check your connection and Firestore rules.' }))
    }, 18000)
    const stop = onSnapshot(query(tasksFor(uid), where('date', '==', date)), snapshot => {
      if (!active) return
      clearTimeout(timer)
      setState({ key, tasks: tasksForDay(snapshot.docs.map(entry => ({ id: entry.id, ...entry.data() })), date), loading: false, error: '' })
    }, error => {
      if (!active) return
      clearTimeout(timer)
      setState({ key, tasks: [], loading: false, error: explainError(error) })
    })
    return () => { active = false; clearTimeout(timer); stop() }
  }, [uid, date, key])
  const setError = useCallback(error => setState(current => current.key === key ? { ...current, error } : current), [key])
  return state.key === key ? { ...state, setError } : { tasks: [], loading: true, error: '', setError }
}
