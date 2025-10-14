import { useState, useEffect } from 'react'
import { listSchemas, getSchema, diffSchema, updateSchema, deleteSchema, saveSchema } from '../../lib/api'

export default function SchemasManager({ schemaJson, setSchemaJson }: any) {
  const [items, setItems] = useState<any[]>([])
  const [selected, setSelected] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [newName, setNewName] = useState('')

  const refresh = async () => {
    setLoading(true)
    try {
      const r = await listSchemas()
      setItems(r.items || [])
    } catch (e:any) {
      alert('Ошибка загрузки списка: ' + e.message)
    } finally { setLoading(false) }
  }

  useEffect(() => { refresh() }, [])

  const handleGet = async (name:string) => {
    try {
      const r = await getSchema(name)
      setSchemaJson(r.schema)
      alert(`✅ Схема «${name}» подгружена`)
    } catch (e:any) {
      alert('Ошибка: '+e.message)
    }
  }

  const handleDiff = async (name:string) => {
    if (!schemaJson) return alert('Сначала загрузите схему')
    try {
      const r = await diffSchema(name, schemaJson)
      alert('Diff выполнен, см. консоль')
      console.log('DIFF', r.diff)
    } catch (e:any) { alert('Ошибка diff: '+e.message) }
  }

  const handleUpdate = async (name:string) => {
    if (!schemaJson) return alert('Сначала загрузите схему')
    try {
      const r = await updateSchema(name, schemaJson)
      alert(`♻️ ${r.reason || 'Обновлено'}`)
      refresh()
    } catch (e:any) { alert('Ошибка update: '+e.message) }
  }

  const handleDelete = async (name:string) => {
    if (!confirm(`Удалить ${name}?`)) return
    try { await deleteSchema(name); refresh(); alert('🗑 Удалено') }
    catch (e:any) { alert('Ошибка: '+e.message) }
  }

  const handleRename = async (oldName:string) => {
    const newN = prompt('Новое имя для схемы:', oldName)
    if (!newN) return
    try {
      const r = await getSchema(oldName)
      await saveSchema(newN, r.schema)
      await deleteSchema(oldName)
      alert(`Переименовано в ${newN}`)
      refresh()
    } catch (e:any) { alert('Ошибка: '+e.message) }
  }

  return (
    <div style={{marginTop:16}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h3 style={{margin:'0 0 10px'}}>💾 Сохранённые базы</h3>
        <button onClick={refresh} style={{background:'#0b1220',color:'#e5e7eb',border:'1px solid #1f2937',borderRadius:10,padding:'6px 10px',cursor:'pointer'}}>🔄 Обновить список</button>
      </div>

      {loading && <p>Загрузка...</p>}

      {items.length === 0 && !loading && <p style={{opacity:.7}}>Пока нет сохранённых схем.</p>}

      {items.map((x:any) => (
        <div key={x.name} style={{border:'1px solid #1f2937',borderRadius:10,padding:'10px 14px',marginBottom:8,background:'#0f172a'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <b>{x.name}</b>
            <div style={{display:'flex',gap:6}}>
              <button onClick={()=>handleGet(x.name)} style={btn}>⬇ Подгрузить</button>
              <button onClick={()=>handleDiff(x.name)} style={btn}>⚙ Diff</button>
              <button onClick={()=>handleUpdate(x.name)} style={btn}>♻ Обновить</button>
              <button onClick={()=>handleRename(x.name)} style={btn}>✏ Переименовать</button>
              <button onClick={()=>handleDelete(x.name)} style={btnDel}>🗑 Удалить</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

const btn = {
  background:'#0b1220', color:'#e5e7eb',
  border:'1px solid #1f2937', borderRadius:8,
  padding:'4px 8px', cursor:'pointer', fontSize:13
}
const btnDel = {...btn, border:'1px solid #b91c1c', color:'#fca5a5'}
