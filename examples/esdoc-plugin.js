const path = require('path');
const fs = require('fs');

let target;

/**
 * Rewrites the fonts in the output CSS to replace them with our own.
 * Do this instead of overriding for load times and reduction in hackery.
 */
function rewriteFonts() {
  const style = path.join(target, 'css', 'style.css');
  const css = fs.readFileSync(style)
    .toString()
    .replace(/@import url\(.*?Roboto.*?\);/, `@import url('https://fonts.googleapis.com/css?family=Open+Sans:400,600|Source+Code+Pro:400,600');`)
    .replace(/Roboto/g, 'Open Sans');

  fs.writeFileSync(style, `
    ${css}

    code {
      font-family: 'Source Code Pro', monospace;
    }

    pre > code {
      padding: 0.75em 1em;
      line-height: 1.5em;
    }

    ul, ol {
      margin-bottom: 15px;
    }

    hr {
      border: 0;
      height: 2px;
      background: #f5f5f5;
      margin: 15px 0;
    }

    blockquote {
      border-left: 3px solid #eee;
      padding-left: 0.75em;
      margin-bottom: 15px;
      color: #999;
      font-size: 0.9em;
    }
  `);
}

exports.onHandleTag = ev => {
  for (let tag of ev.data.tag) {
    tag.importPath = 'influx';
  }
};

exports.onHandleConfig = ev => {
  target = path.join(process.cwd(), ev.data.config.destination);
};

exports.onComplete = () => {
  rewriteFonts();
};
