const mongoose = require('mongoose');

const adSchema = new mongoose.Schema({
  name: String,
  pagelink: String,
  imagelinks: [String],
  contact: [String]
});

const colorGradientSchema = new mongoose.Schema({
  header: {
    startColor: String,
    endColor: String
  },
  button: {
    startColor: String,
    endColor: String
  },
  buttonBackground: {
    startColor: String,
    endColor: String
  },
  list_title_size: {
    color: String,
    backgroundColor: String
  },
  listbackground: {
    backgroundColor: String
  },
  search_filter: {
    backgroundColor: String
  },
  list_price_size: Number,
  markerColor: String,
  constantData: {
    isPropertyUpload: Boolean,
    homeUrls: [String],
    isStrokeFilter: Boolean,
    isMaterialElevation: Boolean,
    headerHeight: Number,
    appPackageName: String,
    defaultLanguage: String,
    currencyCode: String,
    appName: String,
    appEmail: String,
    appLogo: String,
    appCompany: String,
    appWebsite: String,
    appContact: String,
    facebookLink: String,
    twitterLink: String,
    instagramLink: String,
    youtubeLink: String,
    googlePlayLink: String,
    appleStoreLink: String,
    appVersion: String,
    appUpdateHideShow: String,
    appUpdateVersionCode: Number,
    appUpdateDesc: String,
    appUpdateLink: String,
    appUpdateCancelOption: String,
    priceColor: String,
    callButtonColor: String,
    DetailPageButtonColor: {
      startColor: String,
      endColor: String
    },
    isCallDirect: Boolean,
    homePageLayoutOrder: [Number],
    shadowOnImage: Boolean
  },
  ads: [adSchema]
});

module.exports = mongoose.model('ColorGradient', colorGradientSchema);