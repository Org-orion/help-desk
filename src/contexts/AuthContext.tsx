import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

interface User { id:string; email:string; name:string; role:'admin'|'user'; tier:'vip'|'padrao' }
export type LoginResult='ok'|'invalid'|'upgrade_required'|'rate_limited'|'unavailable'
interface AuthContextType { user:User|null; login:(username:string,password:string,newPassword?:string)=>Promise<LoginResult>; logout:()=>Promise<void>; register:(email:string,password:string,name:string)=>Promise<boolean>; isAuthenticated:boolean; loading:boolean }
const AuthContext=createContext<AuthContextType|undefined>(undefined)

async function loadProfile():Promise<User|null>{
  if(!supabase)return null
  const {data:auth}=await supabase.auth.getUser();if(!auth.user)return null
  const {data,error}=await supabase.from('app_users').select('id,username,name,tier').eq('auth_user_id',auth.user.id).single();if(error||!data)return null
  return {id:data.id,email:data.username,name:data.name,role:data.tier==='admin'?'admin':'user',tier:data.tier==='vip'||data.tier==='admin'?'vip':'padrao'}
}

export function AuthProvider({children}:{children:ReactNode}){
  const [user,setUser]=useState<User|null>(null),[loading,setLoading]=useState(true)
  useEffect(()=>{localStorage.removeItem('helpdesk_user');if(!supabase){setLoading(false);return}void loadProfile().then(setUser).finally(()=>setLoading(false));const {data}=supabase.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')setUser(null);else if(event==='SIGNED_IN'||event==='TOKEN_REFRESHED')void loadProfile().then(setUser)});return()=>data.subscription.unsubscribe()},[])
  const login=async(username:string,password:string,newPassword?:string):Promise<LoginResult>=>{
    if(!supabase)return'unavailable'
    const result=await supabase.functions.invoke('auth-migrate-login',{body:{username,password,...(newPassword?{newPassword}:{})}})
    const status=result.error?.context?.status
    if(status===409)return'upgrade_required';if(status===429)return'rate_limited';if(status===400||status===401)return'invalid'
    const session=result.data?.session;if(result.error||!session?.access_token||!session?.refresh_token)return'unavailable'
    const {error}=await supabase.auth.setSession({access_token:session.access_token,refresh_token:session.refresh_token});if(error)return'unavailable'
    const profile=await loadProfile();if(!profile){await supabase.auth.signOut();return'unavailable'}setUser(profile);return'ok'
  }
  const register=async():Promise<boolean>=>false
  const logout=async()=>{if(supabase)await supabase.auth.signOut();setUser(null);localStorage.removeItem('helpdesk_user')}
  return <AuthContext.Provider value={{user,login,logout,register,isAuthenticated:Boolean(user),loading}}>{children}</AuthContext.Provider>
}
export function useAuth(){const context=useContext(AuthContext);if(!context)throw new Error('useAuth must be used within an AuthProvider');return context}
