import { useState, useEffect } from 'react'
import { listSchemas, getSchema, diffSchema, updateSchema, deleteSchema, saveSchema } from '@/lib/api'

type Toast = {type:'ok'|'warn'|'err', text:string} | null

function ConfirmModal({open, title, text, onCancel, onOk}:{open:boolean,title:string,text:string,onCancel:()=>void,onOk:()=>void}) {
  if (!open) return null
  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,.45)', display:'grid', placeItems:'center', zIndex:100
    }}>
      <div style={{
        width:420, maxWidth:'92vw',
        background:'#0f172a', color:'#e5e7eb',
        border:'1px solid #334155', borderRadius:12, padding:18, boxShadow:'0 10px 40px rgba(0,0,0,.5)'
      }}>
        <h3 style={{margin:'0 0 6px'}}>{title}</h3>
        <p style={{margin:'0 0 14px',opacity:.85}}>{text}</p>
        <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
          <button onClick={onCancel} style={btnGhost}>Отмена</button>
          <button onClick={onOk} style={btnDanger}>Да, выполнить</button>
        </div>
      </div>
    </div>
  )
}

export default function SchemasManager({ schemaJson, setSchemaJson }: any) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [note, setNote] = useState<Toast>(null)

  // modal state
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmTitle, setConfirmTitle] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [confirmAction, setConfirmAction] = useState<null | (()=>Promise<void>)>(null)

  const toast = (type:'ok'|'warn'|'err', text:string) => {
    setNote({ type, text })
    setTimeout(() => setNote(null), 2200)
  }

  const refresh = async () => {
    setLoading(true)
    try {
      const r = await listSchemas()
      setItems(r.items || [])
      // не спамим «Список обновлён» каждый раз
    } catch (e:any) {
      toast('err','Ошибка загрузки списка')
      console.error(e)
    } finally { setLoading(false) }
  }

  useEffect(() => { refresh() }, [])

  const handleGet = async (name:string) => {
    try {
      const r = await getSchema(name)
      setSchemaJson(r.schema)
      toast('ok', `«${name}» подгружена`)
    } catch (e:any) { toast('err','Не удалось подгрузить'); console.error(e) }
  }

  const handleDiff = async (name:string) => {
    if (!schemaJson) return toast('warn','Сначала загрузите схему')
    try {
      const r = await diffSchema(name, schemaJson)
      console.log('DIFF', r.diff)
      toast('ok','Diff рассчитан (см. консоль)')
    } catch (e:any) { toast('err','Ошибка diff'); console.error(e) }
  }

  const ask = (title:string, text:string, action:()=>Promise<void>) => {
    setConfirmTitle(title); setConfirmText(text); setConfirmAction(()=>action); setConfirmOpen(true)
  }

  const handleUpdate = (name:string) => {
    if (!schemaJson) return toast('warn','Сначала загрузите схему')
    ask('Обновить сохранённую схему?',
        `Схема «${name}» будет перезаписана текущей (из правого блока).`,
        async () => {
          try {
            const r = await updateSchema(name, schemaJson)
            toast('ok', r.reason || 'Обновлено')
            refresh()
          } catch (e:any) { toast('err','Ошибка обновления'); console.error(e) }
        })
  }

  const handleDelete = (name:string) => {
    ask('Удалить сохранённую схему?',
        `Действие безвозвратно удалит «${name}».`,
        async () => {
          try { await deleteSchema(name); toast('ok', `Удалено: ${name}`); refresh() }
          catch (e:any) { toast('err','Ошибка удаления'); console.error(e) }
        })
  }

  const handleRename = async (oldName:string) => {
    const newN = prompt('Новое имя для схемы:', oldName) || ''
    if (!newN || newN === oldName) return
    try {
      const r = await getSchema(oldName)
      await saveSchema(newN, r.schema)
      await deleteSchema(oldName)
      toast('ok', `Переименовано в ${newN}`)
      refresh()
    } catch (e:any) { toast('err','Ошибка переименования'); console.error(e) }
  }

  return (
    <div style={{marginTop:16, position:'relative'}}>
      {/* Toast */}
      {note && (
        <div style={{
          position:'fixed', right:16, bottom:16, zIndex:50,
          background: note.type==='ok' ? '#10b98120' : note.type==='warn' ? '#f59e0b20' : '#ef444420',
          border: `1px solid ${note.type==='ok' ? '#10b98160' : note.type==='warn' ? '#f59e0b60' : '#ef444460'}`,
          color:'#e5e7eb', padding:'10px 12px', borderRadius:10, backdropFilter:'blur(2px)'
        }}>
          {note.text}
        </div>
      )}

      {/* Confirm modal */}
      <ConfirmModal
        open={confirmOpen}
        title={confirmTitle}
        text={confirmText}
        onCancel={()=>{ setConfirmOpen(false); setConfirmAction(null) }}
        onOk={async()=>{
          try { await (confirmAction?.()); }
          finally { setConfirmOpen(false); setConfirmAction(null) }
        }}
      />

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h3 style={{margin:'0 0 10px'}}>💾 Сохранённые базы</h3>
        <button onClick={refresh} style={btn}>🔄 Обновить список</button>
      </div>

      {loading && <p style={{opacity:.7}}>Загрузка…</p>}
      {items.length === 0 && !loading && <p style={{opacity:.7}}>Пока нет сохранённых схем.</p>}

      {items.map((x:any) => (
        <div key={x.name} style={{border:'1px solid #1f2937',borderRadius:10,padding:'10px 14px',marginBottom:8,background:'#0f172a'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <b>{x.name}</b>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
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
  padding:'6px 10px', cursor:'pointer', fontSize:13
}
const btnDel = {...btn, border:'1px solid #b91c1c', color:'#fca5a5'}
const btnGhost = {...btn, background:'#0f172a'}
const btnDanger = {...btn, background:'linear-gradient(90deg,#fb7185,#ef4444)', color:'#0b1220', border:'none'}
