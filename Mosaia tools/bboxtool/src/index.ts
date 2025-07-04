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
            location,
        },
        secrets: {
            GEOAPIFY_API_KEY
        }
    } = JSON.parse(event.body) as ParsedEvent;

    try {
        const result = await toolCall(location, GEOAPIFY_API_KEY)

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
