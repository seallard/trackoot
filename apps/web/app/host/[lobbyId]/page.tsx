export default async function HostLobbyPage({
  params,
}: {
  params: Promise<{ lobbyId: string }>;
}) {
  const { lobbyId } = await params;
  return <div>Host lobby: {lobbyId}</div>;
}
