import { Dropdown } from '@carbon/react'
export default function CompactSelect({id,label,value,options,onChange,disabled,hideLabel=false}) {
 const items=options.map(([id,text])=>({id,text}))
 return <div className="compact-select"><Dropdown id={id} titleText={hideLabel?'':label} ariaLabel={label} label={label} size="sm" items={items} itemToString={item=>item?.text||''} selectedItem={items.find(item=>item.id===value)||items[0]} onChange={({selectedItem})=>{if(selectedItem)onChange(selectedItem.id)}} disabled={disabled}/></div>
}
