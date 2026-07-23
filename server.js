import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import worker from "./worker.js";

const host = process.env.HOST || "0.0.0.0";
const port = parsePositiveInteger(process.env.PORT, 8787);
const maxRequestBytes = parsePositiveInteger(
    process.env.MAX_REQUEST_BYTES,
    1024 * 1024
);
const configPath = process.env.WRANGLER_CONFIG || "/app/wrangler.jsonc";
const templatesDirectory = resolve(
    process.env.TEMPLATES_DIRECTORY || "/app/templates"
);

const config = await loadConfig(configPath);
const env = {
    ...(config.vars || {}),
    ASSETS: createAssetsBinding(templatesDirectory),
};

const server = createServer(async (request, response) => {
    try {
        const body = await readRequestBody(request, maxRequestBytes);
        const url = new URL(request.url || "/", getRequestOrigin(request));
        const workerRequest = new Request(url, {
            method: request.method,
            headers: request.headers,
            body,
        });
        const workerResponse = await worker.fetch(workerRequest, env);

        response.writeHead(
            workerResponse.status,
            Object.fromEntries(workerResponse.headers)
        );

        if (!workerResponse.body) {
            response.end();
            return;
        }

        await pipeline(Readable.fromWeb(workerResponse.body), response);
    } catch (error) {
        if (error?.code === "REQUEST_TOO_LARGE") {
            request.resume();
            response.writeHead(413, {
                "Content-Type": "text/plain; charset=UTF-8",
            });
            response.end("Request body too large");
            return;
        }

        console.error("Unhandled request error:", error);
        if (!response.headersSent) {
            response.writeHead(500, {
                "Content-Type": "text/plain; charset=UTF-8",
            });
        }
        response.end("Internal server error");
    }
});

server.listen(port, host, () => {
    console.log(`Seerr Notifier listening on http://${host}:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
        server.close(() => process.exit(0));
    });
}

function parsePositiveInteger(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getRequestOrigin(request) {
    const hostHeader = request.headers.host || `localhost:${port}`;
    return `http://${hostHeader}`;
}

async function readRequestBody(request, limit) {
    if (request.method === "GET" || request.method === "HEAD") {
        return undefined;
    }

    const contentLength = Number.parseInt(request.headers["content-length"], 10);
    if (Number.isFinite(contentLength) && contentLength > limit) {
        throw requestTooLargeError();
    }

    const chunks = [];
    let totalBytes = 0;

    for await (const chunk of request) {
        totalBytes += chunk.length;
        if (totalBytes > limit) {
            throw requestTooLargeError();
        }
        chunks.push(chunk);
    }

    return chunks.length > 0 ? Buffer.concat(chunks, totalBytes) : undefined;
}

function requestTooLargeError() {
    return Object.assign(new Error("Request body too large"), {
        code: "REQUEST_TOO_LARGE",
    });
}

function createAssetsBinding(directory) {
    return {
        async fetch(request) {
            let pathname;
            try {
                pathname = decodeURIComponent(new URL(request.url).pathname);
            } catch {
                return new Response("Invalid asset path", { status: 400 });
            }

            const relativePath = pathname.replace(/^\/+/, "");
            const filePath = resolve(directory, relativePath);
            if (
                filePath !== directory &&
                !filePath.startsWith(`${directory}${sep}`)
            ) {
                return new Response("Forbidden", { status: 403 });
            }

            try {
                const contents = await readFile(filePath);
                return new Response(contents, {
                    headers: {
                        "Content-Type": getContentType(filePath),
                    },
                });
            } catch (error) {
                if (error?.code === "ENOENT" || error?.code === "EISDIR") {
                    return new Response("Not found", { status: 404 });
                }
                throw error;
            }
        },
    };
}

function getContentType(filePath) {
    const extension = extname(filePath).toLowerCase();
    const contentTypes = {
        ".html": "text/html; charset=UTF-8",
        ".json": "application/json; charset=UTF-8",
        ".txt": "text/plain; charset=UTF-8",
    };
    return contentTypes[extension] || "text/plain; charset=UTF-8";
}

async function loadConfig(filePath) {
    const contents = await readFile(filePath, "utf8");
    return JSON.parse(stripJsonCommentsAndTrailingCommas(contents));
}

function stripJsonCommentsAndTrailingCommas(input) {
    let withoutComments = "";
    let inString = false;
    let escaped = false;
    let inLineComment = false;
    let inBlockComment = false;

    for (let index = 0; index < input.length; index++) {
        const character = input[index];
        const nextCharacter = input[index + 1];

        if (inLineComment) {
            if (character === "\n" || character === "\r") {
                inLineComment = false;
                withoutComments += character;
            }
            continue;
        }

        if (inBlockComment) {
            if (character === "*" && nextCharacter === "/") {
                inBlockComment = false;
                index++;
            } else if (character === "\n" || character === "\r") {
                withoutComments += character;
            }
            continue;
        }

        if (inString) {
            withoutComments += character;
            if (escaped) {
                escaped = false;
            } else if (character === "\\") {
                escaped = true;
            } else if (character === '"') {
                inString = false;
            }
            continue;
        }

        if (character === '"') {
            inString = true;
            withoutComments += character;
        } else if (character === "/" && nextCharacter === "/") {
            inLineComment = true;
            index++;
        } else if (character === "/" && nextCharacter === "*") {
            inBlockComment = true;
            index++;
        } else {
            withoutComments += character;
        }
    }

    let result = "";
    inString = false;
    escaped = false;

    for (let index = 0; index < withoutComments.length; index++) {
        const character = withoutComments[index];

        if (inString) {
            result += character;
            if (escaped) {
                escaped = false;
            } else if (character === "\\") {
                escaped = true;
            } else if (character === '"') {
                inString = false;
            }
            continue;
        }

        if (character === '"') {
            inString = true;
            result += character;
            continue;
        }

        if (character === ",") {
            let lookahead = index + 1;
            while (/\s/.test(withoutComments[lookahead] || "")) {
                lookahead++;
            }
            if (
                withoutComments[lookahead] === "}" ||
                withoutComments[lookahead] === "]"
            ) {
                continue;
            }
        }

        result += character;
    }

    return result;
}
