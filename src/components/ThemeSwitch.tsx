import { Moon,Sun } from 'lucide-react';
import { useColorMode,setColorMode } from '@/theme';
export default function ThemeSwitch(){const mode=useColorMode();return <button type="button" className="theme-switch" aria-label={mode==='dark'?'Switch to light theme':'Switch to dark theme'} onClick={()=>setColorMode(mode==='dark'?'light':'dark')}>{mode==='dark'?<Sun size={17}/>:<Moon size={17}/>}</button>;}
