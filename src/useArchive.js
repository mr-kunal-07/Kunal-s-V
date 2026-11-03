import { archiveWindow, readArchivePages } from './archive-pagination'
import { useCallback, useEffect, useRef, useState } from 'react'
import { documentId, getDocs, limit, onSnapshot, orderBy, query, startAfter } from 'firebase/firestore'
import { memoriesCollection } from './memories'
import { explainError } from './firebase'
export const ARCHIVE_BATCH_SIZE = 25
export default function useArchive(uid, enabled = true) {
  const [items,setItems] = useState([]), [capacity,setCapacity] = useState(ARCHIVE_BATCH_SIZE)
  const [loading,setLoading] = useState(enabled), [loadingMore,setLoadingMore] = useState(false), [hasMore,setHasMore] = useState(false), [error,setError] = useState('')
  const generation=useRef(0), completePromise=useRef(null), mounted=useRef(true)
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++}},[])
  useEffect(()=>{generation.current++;completePromise.current=null;setItems([]);setCapacity(ARCHIVE_BATCH_SIZE);setHasMore(false)},[uid])
  useEffect(()=>{
    if(!enabled){setLoading(false);return}
    let active=true
    setLoading(true)
    const timer=setTimeout(()=>{if(active){setLoading(false);setLoadingMore(false);setError('The archive is taking too long to connect. Please retry.')}},18000)
    const stop=onSnapshot(query(memoriesCollection(uid),orderBy(documentId()),limit(capacity+1)),snapshot=>{
      if(!active)return
      clearTimeout(timer);const window=archiveWindow(snapshot.docs.map(d=>({id:d.id,...d.data()})),capacity);setItems(window.items)
      setHasMore(window.hasMore);setLoading(false);setLoadingMore(false)
    },err=>{if(active){clearTimeout(timer);setError(explainError(err));setLoading(false);setLoadingMore(false)}})
    return()=>{active=false;clearTimeout(timer);stop()}
  },[uid,enabled,capacity])
  const loadMore=useCallback(()=>{setLoadingMore(true);setError('');setCapacity(n=>n+ARCHIVE_BATCH_SIZE)},[])
  // Full hydration is explicit and limited to operations that require global context.
  const loadComplete=useCallback(()=>{
    if(completePromise.current)return completePromise.current
    const run=generation.current
    setLoadingMore(true);setError('')
    completePromise.current=(async()=>{
      const result=await readArchivePages(async cursor=>{
        const constraints=[orderBy(documentId()),...(cursor?[startAfter(cursor)]:[]),limit(100)]
        const snapshot=await getDocs(query(memoriesCollection(uid),...constraints))
        return {items:snapshot.docs.map(d=>({id:d.id,...d.data()})),hasMore:snapshot.docs.length===100,cursor:snapshot.docs[snapshot.docs.length-1]}
      },()=>run===generation.current&&mounted.current)
      setItems(result);setHasMore(false);setCapacity(Math.max(ARCHIVE_BATCH_SIZE,result.length));return result
    })().catch(err=>{if(mounted.current)setError(explainError(err));throw err}).finally(()=>{completePromise.current=null;if(mounted.current)setLoadingMore(false)})
    return completePromise.current
  },[uid])
  return {items,loading,loadingMore,hasMore,error,setError,loadMore,loadComplete}
}

