export function displayDay(iso) { const [year,month,day]=iso.split('-');const names=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];return `${day} ${names[Number(month)-1]} ${year}` }
export function monthDays(year,month){const first=new Date(Date.UTC(year,month,1)),offset=(first.getUTCDay()+6)%7;return Array.from({length:42},(_,i)=>{const d=new Date(Date.UTC(year,month,1-offset+i));return {iso:`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`,day:d.getUTCDate(),current:d.getUTCMonth()===month}})}

