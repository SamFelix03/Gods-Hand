import fetch from 'node-fetch';

export default async function toolCall(
    location: string,
    apiKey: string
): Promise<any> {
    if (!location) throw new Error('Missing location');
    if (!apiKey) throw new Error('Missing GEOAPIFY_API_KEY');

    const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(location)}&apiKey=${apiKey}`;

    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Geoapify API error: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();

    if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        const bbox = feature.bbox;
        return bbox || null;
    } else {
        return null;
    }
}
