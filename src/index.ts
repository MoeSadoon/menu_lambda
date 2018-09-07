import { Handler, Context, Callback } from 'aws-lambda';
const axios = require('axios');
const cheerio = require('cheerio');

const isHeaderType = (node: CheerioElement): boolean => node.tagName === 'h2';
const isTextType = (node: CheerioElement): boolean => node.type === 'text';

const getText = (el: CheerioElement): Array<string> => {
  const stuff = el.childNodes;
  let result = [];
  stuff.forEach(function(node: CheerioElement) {
    const isHeader = isHeaderType(node);
    const isText = isTextType(node);

    if (isText) {
      result.push(node.nodeValue);
    }
    if (node.childNodes) {
      let d = getText(node);
      if (isHeader) {
        result.push('\n\n');
        d = d.map(s => `*${s}*`);
      }
      result = result.concat(d);
    }
  });
  return result;
};

const handler: Handler = async (event: any, context: Context, callback: Callback) => {
  try {
    const response: any = await axios.get("https://5438cpa251hgt.co.uk");
    const $: CheerioSelector = cheerio.load(response.data);
    const htmlArea: Cheerio = $('[data-url-id="canteen"] [data-type="page"] .col .html-block:nth-child(3) .sqs-block-content');
    const html: Array<string> = getText(htmlArea[0]);
    if (html.length === 0) throw new Error(`Failed to find todays menu`);
    const text = ["Todays menu"].concat(html).join('\n');
    await axios.post('https://hooks.slack.com/services/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', {
      text,
    })
  } catch(err) {
    console.log(err);
  }
};

module.exports = { handler };
