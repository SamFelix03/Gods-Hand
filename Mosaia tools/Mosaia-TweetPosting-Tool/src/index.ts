import toolCall from "./tool-call";

type RawEvent = {
    body: string;
}

type ParsedEvent = {
    args: Record<string, any>;
    secrets: Record<string, string>;
}

export async function handler(event: RawEvent) {
    const {
        args: {
            content,
        },
        secrets: {
            TWITTER_APP_KEY,
            TWITTER_APP_SECRET,
            TWITTER_ACCESS_TOKEN,
            TWITTER_ACCESS_SECRET
        }
    } = JSON.parse(event.body) as ParsedEvent;

    try {
        const result = await toolCall(content, TWITTER_APP_KEY, TWITTER_APP_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET)

        return {
            statusCode: 200,
            body: JSON.stringify(result),
        };
    } catch (error: unknown) {
        let message = '';

        if (error instanceof Error) {
            message = error.message;
        } else {
            message = 'Unknown error';
        }

        return {
            statusCode: 500,
            body: JSON.stringify(message),
        };
    }
}
