import { useEffect, useRef, useState } from 'react';
import { Button, FormField, LoadingState, SectionHeader, Surface } from './ui';

const photoUploadsEnabled = false;
const empty = { text: '', type: 'update', audience: 'family', recipientIds: [] };
function PrivatePhoto({ path, apiRequest }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true; let objectUrl;
    setUrl(null); setError('');
    apiRequest(path, { responseType: 'blob' }).then(blob => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob); setUrl(objectUrl);
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [path, apiRequest]);
  return error ? <p role="status">Photo unavailable: {error}</p> : url ? <img className="social-photo" src={url} alt="Family post attachment" /> : <p>Loading photo…</p>;
}
function Comments({ postId, base, apiRequest, onUnavailable }) {
  const [rows, setRows] = useState([]); const [cursor, setCursor] = useState(null);
  const [text, setText] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function load(before) {
    setBusy(true); setError('');
    try { const result = await apiRequest(`${base}/${postId}/comments${before ? `?before=${encodeURIComponent(before)}` : ''}`);
      if (alive.current) { setRows(previous => before ? [...previous, ...result.comments] : result.comments); setCursor(result.nextCursor); }
    } catch(e) { if (alive.current) { setRows([]); setError(e.message); onUnavailable(); } }
    finally { if (alive.current) setBusy(false); }
  }
  useEffect(() => { load(); }, [postId]);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { await apiRequest(`${base}/${postId}/comments`, { method: 'POST', body: JSON.stringify({text}) }); if (alive.current) { setText(''); await load(); } }
    catch(e) { if (alive.current) { setError(e.message); onUnavailable(); } }
    finally { if (alive.current) setBusy(false); }
  }
  return <div className="social-comments">
    {error && <p role="alert">{error}</p>}
    {rows.map(row => <div key={row.id}><strong>{row.authorName}</strong><small> · {new Date(row.createdAt).toLocaleString()}</small><p className="social-text">{row.text}</p></div>)}
    {cursor && <Button type="button" disabled={busy} onClick={() => load(cursor)}>Older comments</Button>}
    <form onSubmit={submit}><FormField label="Comment"><textarea required maxLength={500} value={text} onChange={e=>setText(e.target.value)} disabled={busy}/></FormField><Button type="submit" disabled={busy || !text.trim()}>Add comment</Button></form>
  </div>;
}
export default function FamilySocial({ family, apiRequest }) {
  const base = `/api/family/${family.id}/posts`;
  const [rows,setRows]=useState([]), [pinned,setPinned]=useState(null), [cursor,setCursor]=useState(null);
  const [composerOpen,setComposerOpen]=useState(false);
  const [draft,setDraft]=useState(empty), [editing,setEditing]=useState(null), [photo,setPhoto]=useState(null);
  const [busy,setBusy]=useState(false), [loading,setLoading]=useState(true), [message,setMessage]=useState('');
  const [comments,setComments]=useState(null); const alive=useRef(true); const generation=useRef(0); const fileInput=useRef(null);
  const recipients=family.acceptedMembers.filter(person=>person.userId!==family.self.userId);
  useEffect(()=>{alive.current=true;load();return()=>{alive.current=false;generation.current++;};},[family.id]);
  async function load(before) {
    const current=++generation.current; setLoading(true);
    try { const result=await apiRequest(base+(before?`?before=${encodeURIComponent(before)}`:''));
      if(alive.current && current===generation.current){setRows(old=>before?[...old,...result.posts.filter(p=>!old.some(x=>x.id===p.id))]:result.posts);setPinned(result.pinned);setCursor(result.nextCursor);}
    } catch(e){if(alive.current && current===generation.current){setRows([]);setPinned(null);setComments(null);setMessage(e.message);}}
    finally{if(alive.current && current===generation.current)setLoading(false);}
  }
  function cancel(){setComposerOpen(false);setDraft(empty);setEditing(null);setPhoto(null);if(fileInput.current)fileInput.current.value='';}
  async function act(action, success) {
    if(busy)return;setBusy(true);setMessage('');
    try{await action();if(alive.current){setMessage(success);await load();}}
    catch(e){if(alive.current){setMessage(e.message);setRows([]);setPinned(null);setComments(null);}}
    finally{if(alive.current)setBusy(false);}
  }
  async function publish(event) {
    event.preventDefault();
    await act(async()=>{
      if(editing)await apiRequest(`${base}/${editing.id}`,{method:'PATCH',body:JSON.stringify({...draft,version:editing.version})});
      else if(photoUploadsEnabled && photo){const form=new FormData();form.append('payload',JSON.stringify(draft));form.append('photo',photo);await apiRequest(base,{method:'POST',body:form});}
      else await apiRequest(base,{method:'POST',body:JSON.stringify(draft)});
      if(alive.current)cancel();
    },editing?'Post updated.':'Post shared.');
  }
  function edit(post){setComposerOpen(true);setEditing(post);setDraft({text:post.text,type:post.type,audience:post.audience,recipientIds:post.recipientIds.filter(id=>recipients.some(r=>r.userId===id))});setPhoto(null);}
  const posts=pinned?[pinned,...rows.filter(p=>p.id!==pinned.id)]:rows;
  return <section aria-label="Family Social" className="family-social">
    <Surface><SectionHeader title="Family Social" description="Private updates for accepted members of this family." action={<div className="family-actions"><Button type="button" disabled={busy} aria-expanded={composerOpen} onClick={()=>composerOpen?cancel():setComposerOpen(true)}>{composerOpen?'Close editor':'Share an update'}</Button><Button type="button" disabled={busy||loading} onClick={()=>load()}>Refresh feed</Button></div>}/>
      {message && <p role="status">{message}</p>}
      {composerOpen && <form onSubmit={publish} className="social-composer">
        <h3>{editing?'Edit your post':'Share an update'}</h3>
        <FormField label="Post"><textarea maxLength={2000} value={draft.text} disabled={busy} onChange={e=>setDraft({...draft,text:e.target.value})}/></FormField>
        <FormField label="Type"><select value={draft.type} disabled={busy} onChange={e=>setDraft({...draft,type:e.target.value})}><option value="update">Update</option><option value="milestone">Milestone</option><option value="announcement">Announcement</option></select></FormField>
        <FormField label="Audience"><select value={draft.audience} disabled={busy} onChange={e=>setDraft({...draft,audience:e.target.value,recipientIds:[]})}><option value="family">All accepted family members</option><option value="selected">Selected members</option></select></FormField>
        {draft.audience==='selected' && <fieldset><legend>Choose accepted recipients</legend>{recipients.length?recipients.map(person=><label className="social-recipient" key={person.id}><input type="checkbox" disabled={busy} checked={draft.recipientIds.includes(person.userId)} onChange={e=>setDraft({...draft,recipientIds:e.target.checked?[...draft.recipientIds,person.userId]:draft.recipientIds.filter(id=>id!==person.userId)})}/>{person.name}</label>):<p>No other accepted members.</p>}</fieldset>}
        {!editing && <FormField label="Optional photo" hint="Photo uploads are temporarily disabled."><input ref={fileInput} type="file" accept="image/jpeg,image/png" disabled={busy || !photoUploadsEnabled} onChange={e=>{const f=e.target.files?.[0];if(f && (f.size>2*1024*1024 || !['image/jpeg','image/png'].includes(f.type))){setMessage('Choose JPEG/PNG up to 2 MiB.');e.target.value='';setPhoto(null);}else setPhoto(f||null);}}/></FormField>}
        <div className="family-actions"><Button type="submit" disabled={busy||(!draft.text.trim()&&!(photoUploadsEnabled && photo)&&!editing?.photoUrl)||(draft.audience==='selected'&&!draft.recipientIds.length)}>{busy?'Saving…':editing?'Save post':'Share post'}</Button>{editing && <Button type="button" disabled={busy} onClick={cancel}>Cancel edit</Button>}</div>
      </form>}
    </Surface>
    {loading && <LoadingState>Loading family updates…</LoadingState>}
    {!loading && !posts.length && <Surface><p>No updates visible yet. Share the first one with your family.</p></Surface>}
    {posts.map(post=><Surface key={post.id} className="social-post"><header><h3>{post.authorName} · {post.type}{post.pinned?' · Pinned':''}</h3><small>{new Date(post.createdAt).toLocaleString()} · {post.audience==='family'?'All accepted family members':'Selected members'}</small></header>
      <p className="social-text">{post.text}</p>{post.photoUrl && <PrivatePhoto path={post.photoUrl} apiRequest={apiRequest}/>}
      <div className="family-actions"><Button type="button" aria-pressed={post.reacted} disabled={busy} onClick={()=>act(()=>apiRequest(`${base}/${post.id}/reactions`,{method:post.reacted?'DELETE':'POST'}),'Reaction updated.')}>{post.reacted?'Unlike':'Like'} ({post.reactionCount})</Button>
        <Button type="button" disabled={busy} onClick={()=>setComments(comments===post.id?null:post.id)}>{comments===post.id?'Hide comments':'Comments'}</Button>
        {post.canEdit && <Button type="button" disabled={busy} onClick={()=>edit(post)}>Edit post</Button>}
        {post.canPin && <Button type="button" disabled={busy} onClick={()=>act(()=>apiRequest(`${base}/${post.id}/pin`,{method:'PUT',body:JSON.stringify({pinned:!post.pinned})}),'Pin updated.')}>{post.pinned?'Unpin':'Pin announcement'}</Button>}
        {post.canRemove && <Button type="button" variant="danger" disabled={busy} onClick={()=>{if(window.confirm('Remove this post for its audience?'))act(()=>apiRequest(`${base}/${post.id}`,{method:'DELETE'}),'Post removed.');}}>Remove post</Button>}
      </div>
      {comments===post.id && <Comments postId={post.id} base={base} apiRequest={apiRequest} onUnavailable={()=>load()}/>}
    </Surface>)}
    {cursor && <Button type="button" disabled={loading||busy} onClick={()=>load(cursor)}>Older posts</Button>}
  </section>;
}
