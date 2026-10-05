"use client";
export default function PrintReportButton(){
 return <button className="primary" onClick={()=>window.print()}>Print / Save as PDF</button>;
}
