import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { LOGO_MINI_SRC } from '@/config/branding'

interface User { id:string; email:string; name:string; role:'admin'|'user'; tier:'vip'|'padrao' }
export type LoginResult='ok'|'invalid'|'upgrade_required'|'rate_limited'|'unavailable'
interface AuthContextType { user:User|null; login:(username:string,password:string,newPassword?:string)=>Promise<LoginResult>; logout:()=>Promise<void>; register:(email:string,password:string,name:string)=>Promise<boolean>; isAuthenticated:boolean; loading:boolean }
const AuthContext=createContext<AuthContextType|undefined>(undefined)

async function loadProfile(authUserId:string):Promise<User|null>{
  if(!supabase)return null
  const {data,error}=await supabase.from('app_users').select('id,username,name,tier').eq('auth_user_id',authUserId).single();if(error||!data)return null
  return {id:data.id,email:data.username,name:data.name,role:data.tier==='admin'?'admin':'user',tier:data.tier==='vip'||data.tier==='admin'?'vip':'padrao'}
}

export function AuthProvider({children}:{children:ReactNode}){
  const [user,setUser]=useState<User|null>(null),[loading,setLoading]=useState(true)
  const authRevision=useRef(0)
  useEffect(()=>{
    localStorage.removeItem('helpdesk_user')
    if(!supabase){setLoading(false);return}
    let active=true

    const applyAuthenticatedUser=async(authUserId:string)=>{
      const revision=++authRevision.current
      const profile=await loadProfile(authUserId)
      if(!active||revision!==authRevision.current)return
      if(!profile){
        setUser(null)
        await supabase.auth.signOut({scope:'local'})
        return
      }
      setUser(profile)
    }

    const {data:listener}=supabase.auth.onAuthStateChange((event,session)=>{
      if(event==='SIGNED_OUT'){
        authRevision.current++
        if(active)setUser(null)
      }else if((event==='INITIAL_SESSION'||event==='SIGNED_IN'||event==='TOKEN_REFRESHED')&&session?.user){
        void applyAuthenticatedUser(session.user.id)
      }
    })

    void(async()=>{
      try{
        let {data:{session},error}=await supabase.auth.getSession()
        if(error&&session?.refresh_token){
          const refreshed=await supabase.auth.refreshSession()
          session=refreshed.data.session
          error=refreshed.error
        }
        if(error||!session){
          authRevision.current++
          if(active)setUser(null)
          return
        }

        const verified=await supabase.auth.getUser()
        if(verified.error||!verified.data.user){
          const refreshed=await supabase.auth.refreshSession()
          if(refreshed.error||!refreshed.data.user){
            await supabase.auth.signOut({scope:'local'})
            return
          }
          await applyAuthenticatedUser(refreshed.data.user.id)
          return
        }
        await applyAuthenticatedUser(verified.data.user.id)
      }finally{
        if(active)setLoading(false)
      }
    })()

    return()=>{
      active=false
      listener.subscription.unsubscribe()
    }
  },[])
  const login=async(username:string,password:string,newPassword?:string):Promise<LoginResult>=>{
    if(!supabase)return'unavailable'
    const result=await supabase.functions.invoke('auth-migrate-login',{body:{username,password,...(newPassword?{newPassword}:{})}})
    const status=result.error?.context?.status
    if(status===409)return'upgrade_required';if(status===429)return'rate_limited';if(status===400||status===401)return'invalid'
    const session=result.data?.session;if(result.error||!session?.access_token||!session?.refresh_token)return'unavailable'
    const {error}=await supabase.auth.setSession({access_token:session.access_token,refresh_token:session.refresh_token});if(error)return'unavailable'
    const profile=await loadProfile(session.user.id);if(!profile){await supabase.auth.signOut({scope:'local'});return'unavailable'}setUser(profile);return'ok'
  }
  const register=async():Promise<boolean>=>false
  const logout=async()=>{if(supabase)await supabase.auth.signOut({scope:'local'});authRevision.current++;setUser(null);localStorage.removeItem('helpdesk_user')}
  if(loading)return <AuthLoadingScreen />
  return <AuthContext.Provider value={{user,login,logout,register,isAuthenticated:Boolean(user),loading}}>{children}</AuthContext.Provider>
}
export function useAuth(){const context=useContext(AuthContext);if(!context)throw new Error('useAuth must be used within an AuthProvider');return context}

function AuthLoadingScreen(){
  return <div className="flex min-h-screen items-center justify-center bg-slate-50" role="status" aria-label="Restaurando sessão">
    <div className="flex flex-col items-center gap-3 text-slate-600">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#012611] shadow-lg">
        <img src={LOGO_MINI_SRC} alt="CONCREM" className="h-6 w-auto" />
      </span>
      <span className="text-sm font-medium">Carregando...</span>
    </div>
  </div>
}
