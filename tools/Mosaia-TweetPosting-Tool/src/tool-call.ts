import { TwitterApi } from 'twitter-api-v2';

export default async function toolCall(
    content: string,
    appKey: string,
    appSecret: string,
    accessToken: string,
    accessSecret: string
): Promise<any> {
    console.log('--- Post to X Tool Debug Log ---');
    console.log('Received content:', content);
    console.log('App Key present:', !!appKey);
    console.log('App Secret present:', !!appSecret);
    console.log('Access Token present:', !!accessToken);
    console.log('Access Secret present:', !!accessSecret);

    if (!content || typeof content !== 'string') {
        console.error('Missing or invalid "content" argument');
        throw new Error('Missing or invalid "content" argument');
    }
    if (!appKey || !appSecret || !accessToken || !accessSecret) {
        console.error('Missing Twitter API credentials');
        throw new Error('Missing Twitter API credentials');
    }

    const twitterClient = new TwitterApi({
        appKey,
        appSecret,
        accessToken,
        accessSecret,
    });

    try {
        console.log('Attempting to post tweet...');
        const response = await twitterClient.v2.tweet(content);
        console.log('Tweet posted successfully:', response);
        return { success: true, tweet: response };
    } catch (error: any) {
        console.error('Error posting tweet:', error);
        return { success: false, error: error.message || error.code || 'Failed to post tweet', details: error };
    }
}
