import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
export type ToastState="sent"|"processed"|"confirmed"|"finalized"|"failed"|"rejected"|"simulating";
export type ToastItem=Readonly<{id:string;title:string;detail:string;state:ToastState;signature?:string}>;
const Context=createContext<{items:readonly ToastItem[];push:(item:Omit<ToastItem,"id">)=>void;remove:(id:string)=>void}>({items:[],push:()=>undefined,remove:()=>undefined});
export function ToastProvider({children}:{children:ReactNode}){const[items,setItems]=useState<readonly ToastItem[]>([]);const push=useCallback((item:Omit<ToastItem,"id">)=>{const id=crypto.randomUUID();setItems((current)=>[...current,{...item,id}]);setTimeout(()=>setItems((current)=>current.filter((entry)=>entry.id!==id)),5000)},[]);const remove=useCallback((id:string)=>setItems((current)=>current.filter((item)=>item.id!==id)),[]);return <Context.Provider value={useMemo(()=>({items,push,remove}),[items,push,remove])}>{children}</Context.Provider>}
export const useToasts=()=>useContext(Context);
