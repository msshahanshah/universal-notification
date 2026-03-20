const sanitizeHtml = require("sanitize-html");

function validateTemplate(htmlContent) {
    const sanitized = sanitizeHtml(htmlContent, {
        allowedTags: [
            "html", "body", "div", "span", "p", "b", "i", "strong", "em",
            "table", "thead", "tbody", "tr", "td", "th",
            "ul", "ol", "li", "a", "img", "br", "hr",
            "h1", "h2", "h3", "h4", "h5", "h6"
        ],
        allowedAttributes: {
            a: ["href", "target"],
            img: ["src", "alt", "width", "height"],
            "*": ["style", "class"]
        },
        allowedSchemes: ["http", "https", "mailto"]
    });

    console.log(sanitized);

    if (sanitized !== htmlContent) {
        throw {
            statusCode : 400,
            message: "Template contains unsafe HTML or script tags"
        }
    }

    return htmlContent;
}

module.exports = validateTemplate;