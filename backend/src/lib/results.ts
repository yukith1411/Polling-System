import { prisma } from "./prisma";

export async function computePollResults(pollId: string) {
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: {
      options: { orderBy: { order: "asc" } },
      authorizedEmails: true,
      votes: { include: { selections: true } },
    },
  });
  if (!poll) return null;

  const counts: Record<string, number> = {};
  for (const opt of poll.options) counts[opt.id] = 0;
  for (const vote of poll.votes) {
    for (const sel of vote.selections) {
      counts[sel.optionId] = (counts[sel.optionId] || 0) + 1;
    }
  }

  const votedEmails = new Set(poll.votes.map((v) => v.voterEmail));
  const notVotedEmails = poll.authorizedEmails
    .map((a) => a.email)
    .filter((email) => !votedEmails.has(email));

  return {
    pollId: poll.id,
    status: poll.status,
    totalAuthorized: poll.authorizedEmails.length,
    totalVoted: poll.votes.length,
    totalNotVoted: notVotedEmails.length,
    options: poll.options.map((o) => ({
      id: o.id,
      text: o.text,
      votes: counts[o.id] || 0,
    })),
  };
}
