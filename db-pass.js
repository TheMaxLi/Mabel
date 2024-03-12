const bcrypt = require("bcrypt");
const fs = require("fs");

// Do not export the entire "DB", nor the "database tables".
// You can't export database tables when you're using a real database.
// I'm trying to teach you patterns that will work in a real database.
// Yes, it's kind of a pain, but not too bad.

const DB_FILE_NAME = "./database_data.json";
const DB = {};
const whitelist_of_tables = ["subs", "articles", "comments", "users"];

const __PARAMETER_NOT_SET = Symbol("parameter not set");

// Helper functions, these should not be exported

function _new_pk(table) {
  let ans;
  while (ans === undefined || table[ans] !== undefined) {
    ans = Math.random().toString().slice(2, 6);
  }
  return ans;
}

function _load_from_json() {
  console.log("LOADING DATABASE FROM JSON");
  for (let k in DB) {
    delete DB[k];
  }

  let data = {};
  for (let k of whitelist_of_tables) {
    data[k] = {};
  }
  try {
    data = fs.readFileSync(DB_FILE_NAME, { encoding: "utf8" });
    data = JSON.parse(data);
  } catch (e) {
    console.log(
      "not really worried, but while trying to load, this did happen:   ",
      e.message
    );
  }

  for (let k of whitelist_of_tables) {
    DB[k] = data[k];
  }
}

async function _save_to_json() {
  try {
    fs.renameSync(DB_FILE_NAME, DB_FILE_NAME + ".bak");
  } catch (e) {
    console.log("it's fine, but we failed to rename to backup", e.message);
  }

  // The next line, if it errors, will crash the app.  This is on purpose.
  fs.writeFileSync(DB_FILE_NAME, debug.str_debug(), { encoding: "utf8" });
}

// Functions for subs

const subs = {
  list: function () {
    return Object.values(DB.subs);
  },
  get_byName: function (name, { withMods = false } = {}) {
    let ans = DB.subs[name];
    if (ans === undefined) {
      return undefined;
    }
    ans = { ...ans };

    if (withMods) {
      ans.mods = { ...DB.mods[ans.name] };
    }

    return ans;
  },
  create: function ({ name, creator }) {
    if (!name || !creator) {
      throw Error("missing parameters for new sub");
    }

    if (DB.subs[name] !== undefined) {
      throw Error("name already exists");
    }

    let creator_id;
    if (creator && typeof creator === "object" && creator.id) {
      // if we got a user object, convert to userid so that next line works
      creator_id = creator.id;
    } else {
      creator_id = creator;
    }

    let creator_object = users.get_byId(creator_id);
    if (creator_object === undefined) {
      throw Error("invalid user id");
    }

    DB.subs[name] = {
      name,
      creator_id,
    };

    subs.add_mod({ sub: name, user: creator_id });

    _save_to_json();
    return DB.subs[name];
  },
  __validate_reference: function (sub_name_or_object) {
    let sub_name;
    if (
      sub_name_or_object &&
      typeof sub_name_or_object === "object" &&
      sub_name_or_object.name
    ) {
      // if we got a sub object, convert to sub so that next line works
      sub_name = sub_name_or_object.name;
    } else {
      sub_name = sub_name_or_object;
    }
    let sub_object = subs.get_byName(sub_name);
    if (sub_object === undefined) {
      throw Error("invalid subjeddit");
    }

    return { sub_name, sub_object };
  },
};

// Functions for articles

const articles = {
  get_byId: function (id) {
    let ans = DB.articles[id];
    if (ans === undefined) {
      return undefined;
    }
    return ans;
  },
  get_byFilter: function (filter_cb, options = {}) {
    let ans = Object.values(DB.articles)
      .filter(filter_cb)
      .map((article) => articles.get_byId(article.id, options));

    let sorting_cb = options.order_by
      ? options.order_by
      : (a, b) => a.ts - b.ts;
    ans.sort(sorting_cb);

    return ans;
  },
  create: function ({ sub, title, link, text, img }) {
    if (!sub || !title || !text || (!link && !img)) {
      console.error({ sub, title, link, text, img });
      throw Error("missing parameters for new article");
    }
    let ts = new Date().toDateString();

    let pk = _new_pk(DB.articles);
    DB.articles[pk] = {
      id: pk,
      sub,
      title,
      link,
      img,
      ts,
      text,
    };
    _save_to_json();
    return DB.articles[pk];
  },
  update: function ({ id, title, link, text = __PARAMETER_NOT_SET }) {
    if (!id || !title || !link) {
      console.error({ id, title, link, text });
      throw Error("missing parameters to update article");
    }

    let article = DB.articles[id];
    if (!article) {
      throw Error("invalid article id");
    }

    article.title = title;
    article.link = link;
    if (text !== __PARAMETER_NOT_SET) {
      article.text = text;
    }

    _save_to_json();
    return DB.articles[id];
  },
  delete: function (id) {
    let article = DB.articles[id];
    if (!article) {
      throw Error("invalid article id");
    }
    delete DB.articles[id];
    _save_to_json();
  },
  __validate_reference: function (article_id_or_object) {
    let article_id;
    if (
      article_id_or_object &&
      typeof article_id_or_object === "object" &&
      article_id_or_object.id
    ) {
      // if we got a article object, convert to articleid so that next line works
      article_id = article_id_or_object.id;
    } else {
      article_id = article_id_or_object;
    }

    let article_object = articles.get_byId(article_id);
    if (article_object === undefined) {
      throw Error("invalid article id: " + article_id);
    }

    return { article_id, article_object };
  },
};

// Functions for users

const users = {
  get_byId: function (
    id,
    {
      withArticles = false,
      withComments = false,
      withVotes = false,
      withCurrentVote = undefined,
      order_by = undefined,
    } = {}
  ) {
    let ans = DB.users[id];
    if (ans === undefined) {
      return undefined;
    }
    ans = { ...ans };

    if (withArticles) {
      ans.articles = articles.get_byFilter(
        (article) => article.creator_id === id,
        { withCreator: true, withVotes, withCurrentVote, order_by }
      );
    }
    if (withComments) {
      ans.comments = comments.get_byFilter(
        (comment) => comment.creator_id === id,
        { withCreator: true, withVotes, withCurrentVote, order_by }
      );
    }

    return ans;
  },
  get_byUsername: function (username, extra_arguments = {}) {
    let user = Object.values(DB.users).find(
      (user) => user.username === username
    );
    if (user === undefined) {
      return undefined;
    } else {
      // punting to get_byId so that extra arguments are processed consistently
      return users.get_byId(user.id, extra_arguments);
    }
  },
  __validate_reference: function (user_id_or_object) {
    let user_id;
    if (
      user_id_or_object &&
      typeof user_id_or_object === "object" &&
      user_id_or_object.id
    ) {
      // if we got a user object, convert to userid so that next line works
      user_id = user_id_or_object.id;
    } else {
      user_id = user_id_or_object;
    }

    let user_object = users.get_byId(user_id);
    // console.log({ user_object })
    if (user_object === undefined) {
      throw Error("invalid user id");
    }

    return { user_id, user_object };
  },
};

const comments = {
  get_byId: function (id, options = {}) {
    let {
      withCreator = false,
      withVotes = false,
      withCurrentVote = undefined,
      withNestedComments = false,
    } = options;
    let ans = DB.comments[id];
    if (ans === undefined) {
      return undefined;
    }
    ans = { ...ans };

    if (withCreator) {
      ans.creator = users.get_byId(ans.creator_id);
    }
    if (withVotes) {
      let votes = Object.values(DB.comments_votes).filter(
        (v) => v.comment_id === id
      );
      let upvotes = 0;
      let downvotes = 0;
      for (let v of votes) {
        if (v.vote_value > 0) {
          upvotes++;
        }
        if (v.vote_value < 0) {
          downvotes++;
        }
      }
      ans.upvotes = upvotes;
      ans.downvotes = downvotes;
    }
    if (withCurrentVote !== undefined) {
      ans.current_vote = comments.get_vote({
        comment: ans,
        voter: withCurrentVote,
      });
    }
    if (withNestedComments) {
      ans.children = ans.children.map((child_id) =>
        comments.get_byId(child_id, options)
      );
    } else {
      ans.children = [];
    }

    return ans;
  },
  get_byFilter: function (filter_cb, options = {}) {
    let ans = Object.values(DB.comments)
      .filter(filter_cb)
      .map((comment) => comments.get_byId(comment.id, options));

    let sorting_cb = options.order_by
      ? options.order_by
      : (a, b) => a.ts - b.ts;
    ans.sort(sorting_cb);

    return ans;
  },
  create: function ({
    creator,
    text,
    article,
    ts = undefined,
    parent = undefined,
  }) {
    if (!creator || !text || !article) {
      throw Error("missing parameters for new comment");
    }
    ts = ts || Date.now();

    let { user_id: creator_id, user_object } =
      users.__validate_reference(creator);
    let { article_id, article_object } = articles.__validate_reference(article);

    if (parent) {
      let { comment_id, comment_object } =
        comments.__validate_reference(parent);
      parent = comment_id;
    }

    let pk = _new_pk(DB.comments);
    DB.comments[pk] = {
      id: pk,
      article_id,
      creator_id,
      ts,
      text,
      parent,
      children: [],
    };
    if (parent) {
      DB.comments[parent].children.push(pk);
    }

    _save_to_json();
    return DB.comments[pk];
  },
  update: function ({ id, text }) {
    if (!id || !text) {
      console.error({ id, text });
      throw Error("missing parameters to update comment");
    }

    let comment = DB.comments[id];
    if (!comment) {
      throw Error("invalid comment id");
    }

    comment.text = text;

    _save_to_json();
    return DB.comments[id];
  },
  delete: function (id) {
    let comment = DB.comments[id];
    if (!comment) {
      throw Error("invalid comment id");
    }
    if (comment.children?.length > 0) {
      comment.creator_id = undefined;
      comment.text = undefined;
    } else {
      if (comment.parent) {
        DB.comments[comment.parent].children = DB.comments[
          comment.parent
        ].children.filter((cid) => cid != id);
      }
      delete DB.comments[id];
    }
    _save_to_json();
  },
  __validate_reference: function (comment_id_or_object) {
    let comment_id;
    if (
      comment_id_or_object &&
      typeof comment_id_or_object === "object" &&
      comment_id_or_object.id
    ) {
      // if we got a comment object, convert to commentid so that next line works
      comment_id = comment_id_or_object.id;
    } else {
      comment_id = comment_id_or_object;
    }

    let comment_object = comments.get_byId(comment_id);
    if (comment_object === undefined) {
      throw Error("invalid comment id: " + comment_id);
    }

    return { comment_id, comment_object };
  },
};

// Functions for debugging

const debug = {
  str_debug: function () {
    return JSON.stringify(DB, null, 2);
  },
  log_debug: function () {
    console.log("PRINTOUT OF DATABASE");
    for (let table_name in DB) {
      console.log("\n##", table_name, "##");
      console.log(JSON.stringify(DB[table_name], null, 2));
    }
  },
};

_load_from_json();
// debug.reset_and_seed();

module.exports = {
  subs,
  articles,
  comments,
  users,
  debug,
};
