export type LadderSide = "buy" | "sell";
export type LadderOrder = { id:string; side:LadderSide; targetMc:number; targetChangePct:number; allocationPct:number; status:"pending"|"filled"|"cancelled" };

export function targetFromChange(currentMc:number, changePct:number){ return Math.max(0,currentMc*(1+changePct/100)); }
export function changeFromTarget(currentMc:number,targetMc:number){ return currentMc<=0?0:((targetMc/currentMc)-1)*100; }
export function normalizeAllocation(orders:LadderOrder[]){ const total=orders.reduce((sum,o)=>sum+o.allocationPct,0); return {total,remaining:Math.max(0,100-total),valid:total>0&&total<=100}; }
export function createPartialTakeProfitLadder(currentMc:number, steps:number[]=[25,50,100,200], allocationPct:number=10):LadderOrder[]{ return steps.map((changePct,index)=>({id:`tp-${index+1}`,side:"sell",targetMc:targetFromChange(currentMc,changePct),targetChangePct:changePct,allocationPct,status:"pending"})); }
export function createBuyLadder(currentMc:number, steps:number[]=[-10,-20,-30], allocationPct:number=10):LadderOrder[]{ return steps.map((changePct,index)=>({id:`buy-${index+1}`,side:"buy",targetMc:targetFromChange(currentMc,changePct),targetChangePct:changePct,allocationPct,status:"pending"})); }
