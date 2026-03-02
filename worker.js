function flattenObject(obj, prefix = "", res = {}) {
    // --- Flatten nested object into a single-level object ---
    for (const key in obj) {
        const value = obj[key];
        const newKey = prefix ? `${prefix}_${key}` : key;

        console.log(`Processing key: ${newKey}, value:`, value);

        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
            console.log(`Recursing into nested object at key: ${newKey}`);
            flattenObject(value, newKey, res);
        } else {
            res[newKey] = value;
            console.log(`Set flat key: ${newKey} = ${value}`);
        }
    }
    return res;
}

function renderTemplate(template, data) {
    console.log("Original template:", template);
    console.log("Data for template:", data);

    // Helper: render a block without processing loops (used for per-iteration rendering)
    function renderBlock(block, ctx) {
        // conditionals: support both equality and simple truthy checks
        block = block.replace(/{{if (.*?)}}([\s\S]*?){{endif}}/g, (_, condition, content) => {
            try {
                const parts = condition.trim().split(/\s+/);
                if (parts.length === 1) {
                    // simple truthy check
                    const key = parts[0];
                    return ctx[key] ? content : "";
                }

                const [left, operator, ...rightParts] = parts;
                const rightRaw = rightParts.join(" ");
                const right = rightRaw.replace(/"/g, "");

                if (operator === "==") {
                    return ctx[left] == right ? content : "";
                }
                if (operator === "!=") {
                    return ctx[left] != right ? content : "";
                }

                return "";
            } catch (err) {
                console.error("Error evaluating condition:", err);
                return "";
            }
        });

        // Replace variables
        block = block.replace(/{{(.*?)}}/g, (_, key) => {
            const value = ctx[key.trim()];
            return value != null ? value : "";
        });

        return block;
    }

    // --- Handle for-loops: {{for item in collection}}...{{endfor}} ---
    const forRegex = /{{for\s+(\w+)\s+in\s+(\w+)}}([\s\S]*?){{endfor}}/g;
    template = template.replace(forRegex, (_, varName, collectionName, content) => {
        const collection = data[collectionName];
        if (!Array.isArray(collection) || collection.length === 0) return "";

        const collectionNumbers = data[`${collectionName}_numbers`] || [];
        const pieces = [];

        for (let i = 0; i < collection.length; i++) {
            const item = collection[i];
            const number = collectionNumbers[i] != null ? collectionNumbers[i] : item;
            const ctx = Object.assign({}, data);
            ctx[varName] = item; // padded value (e.g. '01')
            ctx[`${varName}_number`] = number; // raw number (e.g. '1')
            pieces.push(renderBlock(content, ctx));
        }

        return pieces.join("");
    });

    // Finally render remaining conditionals and variables for the whole template
    const rendered = renderBlock(template, data);
    console.log("Rendered template:", rendered);
    return rendered;
}

export default {
    async fetch(request, env) {
        console.log(`Incoming request method: ${request.method}`);

        // --- Check Authorization header ---
        const auth = request.headers.get("Authorization");
        const expectedToken = env.SECRET_TOKEN; // token from environment variables
        console.log(`Authorization header: ${auth}`);

        if (!auth || auth !== `${expectedToken}`) {
            console.warn("Unauthorized access attempt");
            return new Response("Unauthorized", { status: 401 });
        }

        if (request.method === "GET" || request.method === "HEAD") {
            console.log("GET/HEAD request, returning no data");
            return new Response("No data", { status: 200 });
        }

        try {
            const body = await request.json();
            console.log("Request body:", body);

            if (body.notification_type !== "MEDIA_AVAILABLE") {
                console.log(`Ignored notification type: ${body.notification_type}`);
                return new Response("Ignored notification type", { status: 200 });
            }

            const flatData = flattenObject(body);
            console.log("Flattened data:", flatData);

            // --- Extract season(s) from `extra` array and add to template data ---
            // Support multiple seasons like '1, 2, 3' and provide:
            // - `seasons` (array of zero-padded strings)
            // - `seasons_numbers` (array of raw numbers as strings)
            // - `seasons_count` (number)
            // - `multiple_seasons` (boolean)
            // Keep backward-compatible `season` and `season_number` for first item.
            try {
                const extraArr = body.extra;
                if (Array.isArray(extraArr)) {
                    const seasonEntry = extraArr.find(e => e && e.name === 'Requested Seasons');
                    if (seasonEntry && seasonEntry.value != null) {
                        const raw = String(seasonEntry.value);
                        // split on commas and non-digit separators, keep numbers only
                        const parts = raw.split(/,|;/).map(p => p.trim()).filter(Boolean);
                        const seasons = [];
                        const seasons_numbers = [];

                        for (const part of parts) {
                            const m = String(part).match(/(\d+)/);
                            if (m) {
                                const num = parseInt(m[1], 10);
                                const padded = num < 10 ? `0${num}` : String(num);
                                seasons.push(padded);
                                seasons_numbers.push(String(num));
                            }
                        }

                        if (seasons.length > 0) {
                            flatData.seasons = seasons;
                            flatData.seasons_numbers = seasons_numbers;
                            flatData.seasons_count = seasons.length;
                            flatData.multiple_seasons = seasons.length > 1;
                            // backward-compatible single season fields (first season)
                            flatData.season = seasons[0];
                            flatData.season_number = seasons_numbers[0];
                            console.log(`Detected seasons: ${seasons.join(', ')}`);
                        }
                    }
                }
            } catch (e) {
                console.error('Error extracting season from extra:', e);
            }

            const lang = env.LANG || "pl";
            const templatePath = `/${lang}`;
            console.log(`Fetching template for language: ${lang}`);

            const templateResponse = await env.ASSETS.fetch(
                new Request(`https://assets${templatePath}`)
            );

            if (!templateResponse.ok) {
                console.error("Template not found at:", `https://assets${templatePath}`);
                return new Response("Template not found", { status: 500 });
            }

            const template = await templateResponse.text();
            console.log("Template fetched successfully");

            const result = renderTemplate(template, flatData);
            console.log("Final rendered result:", result);

            // --- Sending message to CallMeBot ---
            const username = body.request?.requestedBy_username;
            console.log("Requested by username:", username);

            if (username) {
                const envKeyName = `CALLMEBOT_KEYS_${username}`;
                const keys = (env[envKeyName] || "").split(" ").filter(k => k);
                console.log(`CallMeBot keys for ${username}:`, keys);

                // --- Check environment variable to allow sending images ---
                const sendImages = env.SEND_IMAGES !== "false"; // default: true
                console.log(`SEND_IMAGES environment variable: ${env.SEND_IMAGES}, sending images enabled: ${sendImages}`);

                for (const key of keys) {
                    // --- Send image first, if available and enabled ---
                    if (sendImages && body.image) {
                        const imageUrl = body.image;
                        const imageApiUrl = `https://api.callmebot.com/facebook/send.php?apikey=${key}&image=${encodeURIComponent(imageUrl)}`;
                        console.log(`Sending image to CallMeBot with key: ${key}, image URL: ${imageUrl}`);
                        try {
                            await fetch(imageApiUrl);
                            console.log(`Image sent successfully with key: ${key}`);
                        } catch (e) {
                            console.error(`Error sending image with apikey ${key}:`, e);
                        }
                    } else if (!body.image) {
                        console.log(`No image found in request for key: ${key}, skipping image send`);
                    } else {
                        console.log(`SEND_IMAGES is false, skipping image send for key: ${key}`);
                    }

                    // --- Send text message afterwards ---
                    const url = `https://api.callmebot.com/facebook/send.php?apikey=${key}&text=${encodeURIComponent(result)}`;
                    console.log(`Sending message to CallMeBot with key: ${key}`);
                    try {
                        await fetch(url);
                        console.log(`Message sent successfully with key: ${key}`);
                    } catch (e) {
                        console.error(`Error sending message with apikey ${key}:`, e);
                    }
                }
            }

            return new Response(result, {
                status: 200,
                headers: { "Content-Type": "text/plain; charset=UTF-8" }
            });

        } catch (err) {
            console.error("Error processing request:", err);
            return new Response("Error processing data", { status: 400 });
        }
    },
};
