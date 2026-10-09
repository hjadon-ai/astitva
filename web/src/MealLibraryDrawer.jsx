import {useEffect,useRef} from 'react';
import {X,Library} from 'lucide-react';
import {IconButton} from './ui';

export default function MealLibraryDrawer({open,onClose,children}){
 const dialogRef=useRef(null),closeRef=useRef(null);
 useEffect(()=>{const dialog=dialogRef.current;if(!open){if(dialog.open)dialog.close();return;}
  const previousFocus=document.activeElement,overflow=document.body.style.overflow;
  dialog.showModal();document.body.style.overflow='hidden';closeRef.current?.focus();
  return()=>{if(dialog.open)dialog.close();document.body.style.overflow=overflow;previousFocus?.focus?.()};
 },[open]);
 return <dialog ref={dialogRef} className="meal-library-drawer" aria-labelledby="meal-library-drawer-title" onCancel={event=>{event.preventDefault();if(!dialogRef.current.querySelector('.confirm-dialog'))onClose()}} onPointerDown={event=>{if(event.target!==event.currentTarget)return;const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)onClose()}}>
  <header className="meal-library-drawer-header"><div><Library size={21} aria-hidden="true"/><div><h2 id="meal-library-drawer-title">Meal libraries</h2><p>Your collections and public discoveries.</p></div></div><IconButton ref={closeRef} icon={X} label="Close libraries" onClick={onClose}/></header>
  <div className="meal-library-drawer-body">{children}</div>
 </dialog>
}
