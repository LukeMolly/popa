"use client";
import {useState} from "react";
export function ClubLogo({className=""}:{className?:string}){
 const [failed,setFailed]=useState(false);
 return failed?<span className={"mini-crest "+className}>TR</span>:<img src="/township-rollers-logo.png" alt="Township Rollers FC crest" className={"site-logo "+className} onError={()=>setFailed(true)}/>;
}
