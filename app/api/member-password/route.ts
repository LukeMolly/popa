// Member accounts have been retired; only administrator login remains active.
export async function POST() {
  return Response.json({ error: "Member PIN management is no longer available. Please contact the membership admin." }, { status: 410 });
}
