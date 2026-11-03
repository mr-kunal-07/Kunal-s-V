export function archiveWindow(docs, capacity) {
 return {items:docs.slice(0,capacity),hasMore:docs.length>capacity}
}
export async function readArchivePages(fetchPage, isCurrent = () => true) {
 const items=[];const seen=new Set();let cursor=null
 while(true){
  const page=await fetchPage(cursor)
  if(!isCurrent())throw new Error('Archive changed. Please retry.')
  for(const item of page.items)if(!seen.has(item.id)){seen.add(item.id);items.push(item)}
  if(!page.hasMore)return items
  if(!page.cursor||page.cursor===cursor)throw new Error('Archive pagination did not advance.')
  cursor=page.cursor
 }
}
