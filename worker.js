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

    // --- Handle conditional blocks ---
    template = template.replace(
        /{{if (.*?)}}(.*?){{endif}}/gs,
        (_, condition, content) => {
            console.log(`Evaluating condition: "${condition}"`);
            try {
                const [left, operator, rightRaw] = condition.trim().split(" ");
                const right = rightRaw.replace(/"/g, "");

                if (operator === "==" && data[left] == right) {
                    console.log(`Condition true for key: ${left}`);
                    return content;
                }
                console.log(`Condition false for key: ${left}`);
                return "";
            } catch (err) {
                console.error("Error evaluating condition:", err);
                return "";
            }
        }
    );

    // --- Replace variables ---
    template = template.replace(/{{(.*?)}}/g, (_, key) => {
        const value = data[key.trim()] ?? "";
        console.log(`Replacing variable: ${key.trim()} => ${value}`);
        return value;
    });

    console.log("Rendered template:", template);
    return template;
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

            // --- Extract season number from `extra` array and add to template data ---
            // If a 'Requested Seasons' entry exists, parse its numeric value and
            // provide a zero-padded `season` variable for templates (e.g. '03').
            try {
                const extraArr = body.extra;
                if (Array.isArray(extraArr)) {
                    const seasonEntry = extraArr.find(e => e && e.name === 'Requested Seasons');
                    if (seasonEntry && seasonEntry.value != null) {
                        const matched = String(seasonEntry.value).match(/(\d+)/);
                        if (matched) {
                            const seasonNum = parseInt(matched[1], 10);
                            const padded = seasonNum < 10 ? `0${seasonNum}` : String(seasonNum);
                            flatData.season = padded; // zero-padded season string for templates
                            flatData.season_number = String(seasonNum); // raw season number as string
                            console.log(`Detected season: ${seasonNum}, padded: ${padded}`);
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
