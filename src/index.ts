import { Handler, Context, Callback } from 'aws-lambda';
const axios = require('axios');
const dateFormat = require('dateformat');
const cheerio = require('cheerio');
const blackList = ['noscript', 'script'];
const isBlacklisted = (node: CheerioElement): boolean => blackList.indexOf(node.name) >= 0;
const isTextType = (node: CheerioElement): boolean => node.type === 'text';
const currentDayName = dateFormat(new Date(), 'dddd').toLowerCase();
const attachmentMap = {
  global: {
    color: "#00BFFF",
    title: "Global Kitchen",
    text: '',
  },
  classic: {
    color: "#FF1493",
    title: "Classic",
    text: '',
  },
  herbivore: {
    color: "#36a64f",
    title: "Herbivore",
    text: '',
  },
}

const setDays = () : void => {
  ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].forEach((day : string) => {
    attachmentMap[day] = {
      color: "#FF5733",
      title: "Cafe",
      text: '',
    }
  });
}

setDays();

const attachmentKeys = Object.keys(attachmentMap).map(key => ({ key, validate: new RegExp(`^${key}`, 'i') }));

/* Private Member(s) */

const getFormattedDate = () : string => dateFormat(new Date(), 'dddd, mmmm dS yyyy');

const getSectionMatch = (item : string) : any => {
  const match = attachmentKeys.find((attachment : any) => attachment.validate.test(item));
  return match ? match.key : null;
}

const getTextFromNode = (el: CheerioElement) : Array<string> => {
  const stuff = el.childNodes;
  let result = [];
  stuff.forEach(function (node) {
    if (!isBlacklisted(node)) {
      const isText = isTextType(node);
      if (isText) {
        result.push(node.nodeValue.replace(/^\s+/, ''));
      }
      if (node.childNodes) {
          let d = getTextFromNode(node);
          result = result.concat(d);
      }
    }
  });
  return result;
};

const getCafeText = (children) : Array<string> => {
  let result = [];
  for (let i = 0, j = children.length; i < j; i += 1) {
    result = result.concat(getTextFromNode(children[i]));
  }
  return result;
};

const filterAttachmentFor = (target: Array<string>) => {
  return target.reduce((o, item) => {
    const sectionName = getSectionMatch(item);
    if (sectionName) {
      o.currentHeader = sectionName;
      o.payload[sectionName] = attachmentMap[sectionName];
    }
    if (o.currentHeader && !sectionName) {
      o.payload[o.currentHeader].text += `${item}\n`;
    }
    return o;
  }, { currentHeader: '', payload: {} });
}

const formatMessageFromText = (menuArea, cafeArea) : object => {
  const payload = {
    text: `Menu for ${getFormattedDate()}`,
    attachments: []
  }
  const mainMenuAttachments = filterAttachmentFor(menuArea);
  const cafeAreaAttachments = filterAttachmentFor(cafeArea);
  payload.attachments = Object.values(mainMenuAttachments.payload);
  payload.attachments.push(cafeAreaAttachments.payload[currentDayName]);
  
  // format cafe
  return payload;
}

/* Public Member(s) */

const handler: Handler = async (event: any, context: Context, callback: Callback) => {
  const SLACK_WEB_HOOK = process.env.SLACK_WEB_HOOK;
  const CANTEEN_14_URL = process.env.CANTEEN_14_URL;
  if (!SLACK_WEB_HOOK || !CANTEEN_14_URL)
    throw new Error('Invalid arguments');
  try {
    const response: any = await axios.get(CANTEEN_14_URL);
    const $: CheerioSelector = cheerio.load(response.data);
    const mainMenuEl: Cheerio = $('[data-url-id="canteen"] [data-type="page"] .col .html-block:nth-child(3) .sqs-block-content');
    const textFromMainMenu: Array<string> = getTextFromNode(mainMenuEl[0]);
    const cafeAreaEl = $('[data-url-id="deli"] .has-content .sqs-block-content:nth-child(1) > *');
    const textFromCafe = getCafeText(cafeAreaEl);
    const payload = formatMessageFromText(textFromMainMenu, textFromCafe);
    await axios.post(SLACK_WEB_HOOK, payload);
  } catch(err) {
    console.log(err);
  }
};

module.exports = { handler };
