import { ScanCommand, GetCommand, PutCommand, QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "./client";
import { Vote } from "../types/database";

const TABLE_NAME = "gods-hand-votes";

export const votesService = {
  // Store a new vote
  async createVote(voteData: Omit<Vote, "id" | "created_at">): Promise<Vote> {
    try {
      const vote: Vote = {
        ...voteData,
        id: `vote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        created_at: new Date().toISOString(),
      };

      const command = new PutCommand({
        TableName: TABLE_NAME,
        Item: vote,
      });

      await docClient.send(command);
      return vote;
    } catch (error) {
      console.error("Error creating vote:", error);
      throw error;
    }
  },

  // Get all votes for a specific claim
  async getVotesByClaimId(claimId: string): Promise<Vote[]> {
    try {
      const command = new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "claim-id-index",
        KeyConditionExpression: "claim_id = :claimId",
        FilterExpression: "attribute_not_exists(deleted)",
        ExpressionAttributeValues: {
          ":claimId": claimId,
        },
      });

      const result = await docClient.send(command);
      return (result.Items || []) as Vote[];
    } catch (error) {
      console.error("Error fetching votes:", error);
      throw error;
    }
  },

  // Check if consensus is reached and calculate majority
  async checkConsensus(claimId: string): Promise<{
    hasConsensus: boolean;
    voteCount: number;
    majorityVote?: string;
    votesSummary: {
      accept: number;
      reject: number;
      raise_amount: number;
      lower_amount: number;
      total: number;
    };
  }> {
    try {
      const votes = await this.getVotesByClaimId(claimId);
      
      // Count votes by type
      const votesSummary = {
        accept: 0,
        reject: 0,
        raise_amount: 0,
        lower_amount: 0,
        total: votes.length,
      };

      votes.forEach(vote => {
        votesSummary[vote.vote_type]++;
      });

      // Check if we have 3 votes
      const hasConsensus = votes.length >= 3;
      let majorityVote: string | undefined;

      if (hasConsensus) {
        // Find the vote type with the most votes
        const voteTypes = ['accept', 'reject', 'raise_amount', 'lower_amount'] as const;
        let maxVotes = 0;
        
        voteTypes.forEach(voteType => {
          if (votesSummary[voteType] > maxVotes) {
            maxVotes = votesSummary[voteType];
            majorityVote = voteType;
          }
        });

        // Handle ties - default to reject for safety
        if (maxVotes === 1) {
          majorityVote = 'reject';
        }
      }

      return {
        hasConsensus,
        voteCount: votes.length,
        majorityVote,
        votesSummary,
      };
    } catch (error) {
      console.error("Error checking consensus:", error);
      throw error;
    }
  },

  // Check if a voter has already voted for a claim
  async hasVoterVoted(claimId: string, voterIdentifier: string): Promise<boolean> {
    try {
      const command = new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "claim-id-index",
        KeyConditionExpression: "claim_id = :claimId",
        FilterExpression: "voter_identifier = :voterIdentifier AND attribute_not_exists(deleted)",
        ExpressionAttributeValues: {
          ":claimId": claimId,
          ":voterIdentifier": voterIdentifier,
        },
      });

      const result = await docClient.send(command);
      return (result.Items || []).length > 0;
    } catch (error) {
      console.error("Error checking if voter has voted:", error);
      throw error;
    }
  },

  // Clear all votes for a claim (used when voting resets for raise/lower amount)
  async clearVotesForClaim(claimId: string): Promise<void> {
    try {
      // First get all votes for this claim
      const votes = await this.getVotesByClaimId(claimId);
      
      // Delete each vote
      for (const vote of votes) {
        const deleteCommand = new DeleteCommand({
          TableName: TABLE_NAME,
          Key: { id: vote.id },
        });
        await docClient.send(deleteCommand);
      }
    } catch (error) {
      console.error("Error clearing votes for claim:", error);
      throw error;
    }
  },
}; 