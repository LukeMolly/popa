export type PaymentMethodCode="fnb"|"stanbic"|"other";

export type PaymentMethod={
 code:PaymentMethodCode;
 label:string;
 accountName?:string;
 bankName?:string;
 accountNumber?:string;
 branch?:string;
 branchCode?:string;
 swiftCode?:string;
};

export const PAYMENT_METHODS:PaymentMethod[]=[
 {
  code:"fnb",
  label:"FNB",
  accountName:"TOWNSHIP ROLLERS FC (PTY) LTD",
  bankName:"FNBB",
  accountNumber:"63138096060",
  branch:"FIRSTPLACE BRANCH",
  branchCode:"283767",
  swiftCode:"FIRNBWGXXXX"
 },
 {
  code:"stanbic",
  label:"Stanbic Bank",
  accountName:"TOWNSHIP ROLLERS FC",
  bankName:"STANBIC BANK",
  accountNumber:"9060006156954",
  branch:"CBD SQUARE BRANCH",
  branchCode:"065167",
  swiftCode:"SBICBWGX"
 },
 {
  code:"other",
  label:"Other payment method"
 }
];

export const PAYMENT_METHOD_CODES=PAYMENT_METHODS.map(x=>x.code);

export function paymentMethodLabel(code:string,detail=""){
 const method=PAYMENT_METHODS.find(x=>x.code===code);
 if(code==="other"&&detail.trim())return "Other · "+detail.trim();
 return method?.label||code||"Unspecified";
}
