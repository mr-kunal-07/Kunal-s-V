import { useEffect, useState } from 'react'
import { todayInIndia } from './daybook-utils'

export default function useTodayInIndia() {
  const [today, setToday] = useState(todayInIndia)
  useEffect(() => {
    const refresh = () => setToday(todayInIndia())
    const timer = setInterval(refresh, 30000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  return today
}
