export default async function PlayPage({
  params,
}: {
  params: Promise<{ lobbyId: string }>;
}) {
  const { lobbyId } = await params;
  return <div>Play: {lobbyId}</div>;
}
