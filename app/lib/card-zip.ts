"use client";

// Create a ZIP using stored entries (PNG files are already compressed).
// No extra dependencies or server upload of private member cards.
export async function zipFiles(files: {name:string; blob:Blob}[]): Promise<Blob> {
  const encoder = new TextEncoder();
  const parts: BlobPart[] = [];
  const directory: Uint8Array[] = [];
  let offset = 0;
  const table = new Uint32Array(256);
  for (let n=0;n<256;n++) {
    let c=n;
    for(let k=0;k<8;k++) c = c&1 ? 0xedb88320^(c>>>1) : c>>>1;
    table[n]=c>>>0;
  }
  const crc32=(bytes:Uint8Array) => {
    let crc=0xffffffff;
    for(const byte of bytes) crc=table[(crc^byte)&255]^(crc>>>8);
    return (crc^0xffffffff)>>>0;
  };
  const put16=(view:DataView,p:number,value:number)=>view.setUint16(p,value,true);
  const put32=(view:DataView,p:number,value:number)=>view.setUint32(p,value>>>0,true);
  for(const file of files) {
    const name=encoder.encode(file.name);
    const data=new Uint8Array(await file.blob.arrayBuffer());
    const crc=crc32(data);
    const local=new Uint8Array(30+name.length);
    const lh=new DataView(local.buffer);
    put32(lh,0,0x04034b50);put16(lh,4,20);put16(lh,6,0x0800);
    put16(lh,8,0);put16(lh,10,0);put16(lh,12,0);
    put32(lh,14,crc);put32(lh,18,data.length);put32(lh,22,data.length);
    put16(lh,26,name.length);put16(lh,28,0);local.set(name,30);
    const central=new Uint8Array(46+name.length);
    const ch=new DataView(central.buffer);
    put32(ch,0,0x02014b50);put16(ch,4,20);put16(ch,6,20);
    put16(ch,8,0x0800);put16(ch,10,0);put16(ch,12,0);put16(ch,14,0);
    put32(ch,16,crc);put32(ch,20,data.length);put32(ch,24,data.length);
    put16(ch,28,name.length);put16(ch,30,0);put16(ch,32,0);
    put16(ch,34,0);put16(ch,36,0);put32(ch,38,0);put32(ch,42,offset);
    central.set(name,46);
    parts.push(local.buffer as ArrayBuffer, data.buffer as ArrayBuffer);directory.push(central);
    offset+=local.length+data.length;
  }
  const directorySize=directory.reduce((sum,chunk)=>sum+chunk.length,0);
  const end=new Uint8Array(22);
  const footer=new DataView(end.buffer);
  put32(footer,0,0x06054b50);put16(footer,4,0);put16(footer,6,0);
  put16(footer,8,files.length);put16(footer,10,files.length);
  put32(footer,12,directorySize);put32(footer,16,offset);put16(footer,20,0);
  return new Blob([...parts,...directory.map(entry=>entry.buffer as ArrayBuffer),end.buffer as ArrayBuffer],{type:"application/zip"});
}

export function saveBlob(blob:Blob, filename:string) {
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;link.download=filename;document.body.appendChild(link);
  link.click();link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),30000);
}
