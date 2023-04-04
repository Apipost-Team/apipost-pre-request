const apipostRequest = require("apipost-send"),
  sm2 = require("sm-crypto").sm2, // add module for 7.0.8
  sm3 = require("sm-crypto").sm3, // add module for 7.0.8
  sm4 = require("sm-crypto").sm4, // add module for 7.0.8
  urljoins = require("urljoins").urljoins, // add module for 7.0.8 https://www.npmjs.com/package/urljoins
  asyncModule = require("async"), // add module 0920
  FormData = require("form-data"), // add module 0914
  _ = require("lodash"),
  chai = require("chai"),
  JSON5 = require("json5"),
  uuid = require("uuid"),
  Mock = require("apipost-mock"),
  CryptoJS = require("crypto-js"),
  jsonpath = require("jsonpath"),
  x2js = require("x2js"),
  $ = require("jquery"),
  nodeAjax = require("ajax-for-node"), // new module on 0829
  JSEncryptNode = require("jsencrypt-node"), // fix bug
  moment = require("moment"),
  dayjs = require("dayjs"),
  vm2 = require("vm2"),
  stripJsonComments = require("strip-json-comments"),
  JSONbig = require("json-bigint"),
  aTools = require("apipost-tools"),
  validCookie = require("check-valid-cookie"),
  urlJoin = require("url-join"), // + new add 必须 4.0.1版本
  qs = require("querystring"),
  UrlParse = require("url-parse"),
  Base64 = require("js-base64"),
  EdgeGridAuth = require("akamai-edgegrid/src/auth"),
  ntlm = require("httpntlm").ntlm,
  OAuth = require("oauth-1.0a"),
  crypto = require("crypto"),
  ATools = require("apipost-tools");

function ApipostPreRequest(emitRuntimeEvent) {
  // 当前流程总错误计数器
  let RUNNER_TOTAL_COUNT = 0, // 需要跑的总event分母
    RUNNER_RESULT_LOG = {},
    RUNNER_STOP = {};

  if (typeof emitRuntimeEvent !== "function") {
    emitRuntimeEvent = function () {};
  }

  // Apipost 沙盒
  const Sandbox = function ApipostSandbox() {
    // 内置变量
    const insideVariablesScope = {
      list: {}, // 常量
    };

    /**
     *  拓展mockjs， 定义一些内置 mock
     *  fix bug for 7.0.8
     */
    const _mockjsRandomExtend = {};

    // 重写 string
    _mockjsRandomExtend["string"] = function (pool, start, end) {
      let charSet =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

      if (typeof pool == "string") {
        charSet = Mock.mock(pool);
      }

      if (typeof pool == "string") {
        pool = Mock.mock(pool);

        if (typeof start == "number") {
          if (typeof end == "number") {
            return _.sampleSize(pool, _.random(start, end)).join("");
          }

          return _.sampleSize(pool, start).join("");
        }
        return _.sample(pool);
      }

      if (typeof pool == "number") {
        if (typeof start == "number") {
          return _.sampleSize(charSet, _.random(pool, start)).join("");
        }
        return _.sampleSize(charSet, pool).join("");
      }
    };

    new Array("telephone", "phone", "mobile").forEach((func) => {
      _mockjsRandomExtend[func] = function () {
        return this.pick(["131", "132", "137", "188"]) + Mock.mock(/\d{8}/);
      };
    });
    new Array("username", "user_name", "nickname", "nick_name").forEach(
      (func) => {
        _mockjsRandomExtend[func] = function () {
          return Mock.mock(`@cname`);
        };
      }
    );
    new Array("avatar", "icon", "img", "photo", "pic").forEach((func) => {
      _mockjsRandomExtend[func] = function () {
        return Mock.mock(`@image('400x400')`);
      };
    });

    new Array("description").forEach((func) => {
      _mockjsRandomExtend[func] = function () {
        return Mock.mock(`@cparagraph`);
      };
    });

    new Array("id", "userid", "user_id", "articleid", "article_id").forEach(
      (func) => {
        _mockjsRandomExtend[func] = function () {
          return Mock.mock(`@integer(100, 1000)`);
        };
      }
    );

    Mock.Random.extend(_mockjsRandomExtend);

    new Array(
      "natural",
      "integer",
      "float",
      "character",
      "range",
      "date",
      "time",
      "datetime",
      "now",
      "guid",
      "integeincrementr",
      "url",
      "protocol",
      "domain",
      "tld",
      "email",
      "ip",
      "region",
      "province",
      "city",
      "county",
      "county",
      "zip",
      "first",
      "last",
      "name",
      "cfirst",
      "clast",
      "cname",
      "color",
      "rgb",
      "rgba",
      "hsl",
      "paragraph",
      "cparagraph",
      "sentence",
      "csentence",
      "word",
      "cword",
      "title",
      "ctitle",
      "username",
      "user_name",
      "nickname",
      "nick_name",
      "avatar",
      "icon",
      "img",
      "photo",
      "pic",
      "description",
      "id",
      "userid",
      "user_id",
      "articleid",
      "article_id"
    ).forEach((func) => {
      insideVariablesScope.list[`$${func}`] = Mock.mock(`@${func}`);
    });

    new Array("phone", "mobile", "telephone").forEach((func) => {
      insideVariablesScope.list[`$${func}`] =
        ["131", "132", "137", "188"][_.random(0, 3)] + Mock.mock(/\d{8}/);
    });

    // 兼容 v3
    insideVariablesScope.list.$timestamp = (function () {
      return Date.parse(new Date()) / 1000;
    })();

    insideVariablesScope.list.$microTimestamp = (function () {
      return new Date().getTime();
    })();

    insideVariablesScope.list.$randomInt = (function () {
      return Math.floor(Math.random() * 1000);
    })();

    insideVariablesScope.list.$randomFloat = (function () {
      return Math.random() * 1000;
    })();

    // 动态变量
    const variablesScope = {
      globals: {}, // 公共变量
      environment: {}, // 环境变量
      collectionVariables: {}, // 目录变量 当前版本不支持，目前为兼容postman
      variables: {}, // 临时变量，无需存库
      iterationData: {}, // 流程测试时的数据变量，临时变量，无需存库
    };

    // 获取所有动态变量
    function getAllDynamicVariables(type) {
      if (typeof aptScripts === "object") {
        Object.keys(variablesScope).forEach((key) => {
          if (
            _.isObject(aptScripts[key]) &&
            _.isFunction(aptScripts[key].toObject) &&
            ["iterationData", "variables"].indexOf(key) > -1
          ) {
            _.assign(variablesScope[key], aptScripts[key].toObject());
          }
        });
      }

      if (variablesScope.hasOwnProperty(type)) {
        return _.isPlainObject(variablesScope[type])
          ? variablesScope[type]
          : {};
      }
      const allVariables = {};
      Object.keys(variablesScope).forEach((type) => {
        _.assign(allVariables, variablesScope[type]);
      });

      // console.log(allVariables);
      return allVariables;
    }

    // 设置动态变量
    const dynamicVariables = {};

    // 变量相关
    // ['variables'] 临时变量
    Object.defineProperty(dynamicVariables, "variables", {
      configurable: true,
      value: {
        set(key, value) {
          if (_.isObject(value)) {
            try {
              value = JSON.stringify(value);
            } catch (e) {
              value = String(value);
            }
          }
          variablesScope.variables[key] = value;
        },
        get(key) {
          const allVariables = getAllDynamicVariables();
          return allVariables[key];
        },
        has(key) {
          return getAllDynamicVariables().hasOwnProperty(key);
        },
        delete(key) {
          delete variablesScope.variables[key];
        },
        unset(key) {
          delete variablesScope.variables[key];
        },
        clear() {
          if (_.isObject(variablesScope.variables)) {
            _.forEach(variablesScope.variables, (value, key) => {
              delete variablesScope.variables[key];
            });
          }
          variablesScope.variables = {};
        },
        replaceIn(variablesStr) {
          return replaceIn(variablesStr);
        },
        toObject() {
          return getAllDynamicVariables();
        },
      },
    });

    // ['iterationData'] 临时变量
    Object.defineProperty(dynamicVariables, "iterationData", {
      configurable: true,
      value: {
        set(key, value) {
          variablesScope.iterationData[key] = value;
        },
        get(key) {
          return variablesScope.iterationData[key];
        },
        has(key) {
          return variablesScope.iterationData.hasOwnProperty(key);
        },
        replaceIn(variablesStr) {
          return replaceIn(variablesStr, "iterationData");
        },
        toObject() {
          return variablesScope.iterationData;
        },
      },
    });

    // ['globals', 'environment', 'collectionVariables']
    Object.keys(variablesScope).forEach((type) => {
      if (["iterationData", "variables"].indexOf(type) === -1) {
        Object.defineProperty(dynamicVariables, type, {
          configurable: true,
          value: {
            set(key, value, emitdb = true) {
              if (_.isObject(value)) {
                try {
                  value = JSON.stringify(value);
                } catch (e) {
                  value = String(value);
                }
              }

              variablesScope[type][key] = value;

              if (emitdb) {
                typeof aptScripts === "object" &&
                  _.isObject(aptScripts[type]) &&
                  _.isFunction(aptScripts[type].set) &&
                  aptScripts[type].set(key, value);
              }
            },
            get(key) {
              return variablesScope[type][key];
            },
            has(key) {
              return variablesScope[type].hasOwnProperty(key);
            },
            delete(key) {
              delete variablesScope[type][key];
              typeof aptScripts === "object" &&
                _.isObject(aptScripts[type]) &&
                _.isFunction(aptScripts[type].delete) &&
                aptScripts[type].delete(key);
            },
            unset(key) {
              delete variablesScope[type][key];
              typeof aptScripts === "object" &&
                _.isObject(aptScripts[type]) &&
                _.isFunction(aptScripts[type].delete) &&
                aptScripts[type].delete(key);
            },
            clear() {
              if (_.isObject(variablesScope[type])) {
                // fix bug
                _.forEach(variablesScope[type], (value, key) => {
                  delete variablesScope[type][key];
                });
              }
              variablesScope[type] = {};
              typeof aptScripts === "object" &&
                _.isObject(aptScripts[type]) &&
                _.isFunction(aptScripts[type].clear) &&
                aptScripts[type].clear();
            },
            replaceIn(variablesStr) {
              return replaceIn(variablesStr, type);
            },
            toObject() {
              return variablesScope[type];
            },
          },
        });
      }
    });

    // 获取所有内置变量
    function getAllInsideVariables() {
      return _.cloneDeep(insideVariablesScope.list);
    }

    // 变量替换
    function replaceIn(variablesStr, type, withMock = false) {
      if (!_.isString(variablesStr)) {
        // fix bug
        return variablesStr;
      }

      let allVariables = getAllInsideVariables(); // fix bug
      // console.log(getAllDynamicVariables(type));
      // let allVariables = {};
      _.assign(allVariables, getAllDynamicVariables(type));

      if (withMock) {
        try {
          // console.log(variablesStr, typeof variablesStr, Mock.mock(`${variablesStr}`))
          variablesStr = Mock.mock(variablesStr);
        } catch (e) {
          console.log(e);
        }
      }

      // 替换自定义变量
      const _regExp = new RegExp(
        Object.keys(allVariables)
          .map((item) => {
            if (_.startsWith(item, "$")) {
              item = `\\${item}`;
            }
            return `\\{\\{${item}\\}\\}`; // fix bug
          })
          .join("|"),
        "gi"
      );

      variablesStr = _.replace(variablesStr, _regExp, (key) => {
        const reStr = allVariables[String(_.replace(key, /[{}]/gi, ""))];
        // console.log(String(_.replace(key, /[{}]/gi, '')), reStr, _regExp);
        if (typeof reStr !== "undefined") {
          return reStr;
        }
        return key;
      });
      // console.log('allVariables', variablesStr, _regExp);
      allVariables = null;
      return variablesStr;
    }

    // console
    const consoleFn = {};

    // 断言自定义拓展规则（100% 兼容postman）
    chai.use(() => {
      require("chai-apipost")(chai);
    });

    async function execute(code, scope, eventName, callback) {
      scope = _.isPlainObject(scope) ? _.cloneDeep(scope) : {};

      // 初始化数据库中的当前变量值 init
      if (typeof aptScripts === "object") {
        Object.keys(variablesScope).forEach((key) => {
          if (
            _.isObject(aptScripts[key]) &&
            _.isFunction(aptScripts[key].toObject) &&
            ["iterationData", "variables"].indexOf(key) > -1
          ) {
            _.assign(variablesScope[key], aptScripts[key].toObject());
          }
        });
      }

      // pm 对象
      const pm = {};

      // info, 请求、响应、cookie, iterationData
      new Array(
        "info",
        "request",
        "response",
        "cookie",
        "iterationData"
      ).forEach((key) => {
        if (_.indexOf(["request", "response"], key) > -1) {
          switch (key) {
            case "request":
              // console.log(scope.script_request);
              if (
                _.has(scope, "script_request") &&
                _.isObject(scope.script_request)
              ) {
                Object.defineProperty(scope.script_request, "to", {
                  get() {
                    return chai.expect(this).to;
                  },
                });

                Object.defineProperty(pm, key, {
                  configurable: true,
                  value: scope.script_request,
                });
              }
              break;
            case "response":
              if (
                _.has(scope, `response.data.${key}`) &&
                _.isObject(scope.response.data[key])
              ) {
                if (scope.response.data[key].hasOwnProperty("rawBody")) {
                  let json = {};

                  try {
                    json = JSON5.parse(scope.response.data[key].rawBody);
                  } catch (e) {}

                  Object.defineProperty(scope.response.data[key], "json", {
                    configurable: true,
                    value() {
                      return _.cloneDeep(json);
                    },
                  });

                  Object.defineProperty(scope.response.data[key], "text", {
                    configurable: true,
                    value() {
                      return scope.response.data[key].rawBody;
                    },
                  });
                }

                Object.defineProperty(scope.response.data[key], "to", {
                  get() {
                    return chai.expect(this).to;
                  },
                });

                Object.defineProperty(pm, key, {
                  configurable: true,
                  value: scope.response.data[key],
                });
              }
              break;
          }
        } else if (_.isObject(scope[key])) {
          switch (key) {
            case "iterationData":
              _.assign(variablesScope.iterationData, scope[key]);
              break;
            case "info":
              _.assign(scope[key], {
                iteration: scope.iteration,
                iterationCount: scope.iterationCount,
                eventName,
              });
              break;
          }

          Object.defineProperty(pm, key, {
            configurable: true,
            value: scope[key],
          });
        }
      });

      // 变量相关
      Object.keys(variablesScope).forEach((type) => {
        Object.defineProperty(pm, type, {
          configurable: true,
          value: dynamicVariables[type],
        });
      });

      if (_.isObject(pm.variables)) {
        Object.defineProperty(pm.variables, "getName", {
          configurable: true,
          value() {
            return scope.env_name;
          },
        });

        Object.defineProperty(pm.variables, "getPreUrl", {
          configurable: true,
          value() {
            return scope.env_pre_url;
          },
        });

        Object.defineProperty(pm.variables, "getCollection", {
          configurable: true,
          value() {
            return scope.environment;
          },
        });

        Object.defineProperty(pm.environment, "getName", {
          configurable: true,
          value() {
            return scope.env_name;
          },
        });

        Object.defineProperty(pm.environment, "getPreUrl", {
          configurable: true,
          value() {
            return scope.env_pre_url;
          },
        });

        Object.defineProperty(pm.environment, "getCollection", {
          configurable: true,
          value() {
            return scope.environment;
          },
        });
      }

      // 请求参数相关
      if (
        typeof scope !== "undefined" &&
        _.isObject(scope) &&
        _.has(scope, "request.request")
      ) {
        // 更新日志
        const item = RUNNER_RESULT_LOG[scope.iteration_id];

        if (item) {
          Object.defineProperty(pm, "setRequestQuery", {
            configurable: true,
            value(key, value) {
              if (_.trim(key) != "") {
                if (!_.has(item, "beforeRequest.query")) {
                  _.set(item, "beforeRequest.query", []);
                }

                item.beforeRequest.query.push({
                  action: "set",
                  key,
                  value,
                });
              }
            },
          });

          Object.defineProperty(pm, "removeRequestQuery", {
            configurable: true,
            value(key) {
              if (_.trim(key) != "") {
                if (!_.has(item, "beforeRequest.query")) {
                  _.set(item, "beforeRequest.query", []);
                }

                item.beforeRequest.query.push({
                  action: "remove",
                  key,
                });
              }
            },
          });

          Object.defineProperty(pm, "setRequestHeader", {
            configurable: true,
            value(key, value) {
              if (_.trim(key) != "") {
                if (!_.has(item, "beforeRequest.header")) {
                  _.set(item, "beforeRequest.header", []);
                }

                item.beforeRequest.header.push({
                  // fix bug for 7.0.8
                  action: "set",
                  key: String(key),
                  value: String(value),
                });
              }
            },
          });

          Object.defineProperty(pm, "removeRequestHeader", {
            configurable: true,
            value(key) {
              if (_.trim(key) != "") {
                if (!_.has(item, "beforeRequest.header")) {
                  _.set(item, "beforeRequest.header", []);
                }

                item.beforeRequest.header.push({
                  action: "remove",
                  key,
                });
              }
            },
          });

          Object.defineProperty(pm, "setRequestBody", {
            configurable: true,
            value(key, value) {
              if (_.trim(key) != "") {
                if (!_.has(item, "beforeRequest.body")) {
                  _.set(item, "beforeRequest.body", []);
                }

                item.beforeRequest.body.push({
                  action: "set",
                  key,
                  value,
                });
              }
            },
          });

          Object.defineProperty(pm, "removeRequestBody", {
            configurable: true,
            value(key) {
              if (_.trim(key) != "") {
                if (!_.has(item, "beforeRequest.body")) {
                  _.set(item, "beforeRequest.body", []);
                }

                item.beforeRequest.body.push({
                  action: "remove",
                  key,
                });
              }
            },
          });
        }
      }

      // expert
      Object.defineProperty(pm, "expect", {
        configurable: true,
        value: chai.expect,
      });

      // 发送方法
      Object.defineProperty(pm, "sendRequest", {
        configurable: true,
        value: nodeAjax, // fix bug
      });

      // 执行
      try {
        // const $ = {};

        $.md5 = function (str) {
          // 兼容旧版
          return CryptoJS.MD5(str).toString();
        };

        $.ajax = await nodeAjax;

        // fix bug
        code = `(async function () {
          ${code}
        })()`;

        await new vm2.VM({
          timeout: 5000,
          sandbox: _.assign(
            {
              ...{ nodeAjax },
              ...{ pm },
              ...{ chai },
              //  ...{ emitAssertResult },
              ...{ JSON5 },
              ...{ _ },
              ...{ Mock },
              ...{ uuid },
              ...{ jsonpath },
              ...{ CryptoJS },
              // ...{ $ },
              ...{ x2js },
              JSEncrypt: JSEncryptNode,
              ...{ moment },
              ...{ dayjs },
              JSON, // 增加 JSON 方法 // fixed JSON5 bug
              // console: consoleFn,
              // print: consoleFn.log,
              async: asyncModule,
              FormData,
              sm2, // fix bug for 7.0.8
              sm3, // fix bug for 7.0.8
              sm4, // fix bug for 7.0.8
              xml2json(xml) {
                return new x2js().xml2js(xml);
              },
              uuidv4() {
                return uuid.v4();
              },
              ...{ uuid },
              ...{ aTools },
              ...{ validCookie },
              ...{ urlJoin },
              urljoins, // fix bug for 7.0.8
              apt: pm,
              $,
              // Promise,
              request: pm.request ? _.cloneDeep(pm.request) : {},
              response: pm.response
                ? _.assign(pm.response, {
                    json: _.isFunction(pm.response.json)
                      ? pm.response.json()
                      : pm.response.json,
                  })
                : {},
              expect: chai.expect,
              sleep(ms) {
                const end = Date.now() + parseInt(ms);
                while (true) {
                  if (Date.now() > end) {
                    return;
                  }
                }
              },
            },
            variablesScope
          ),
        }).run(new vm2.VMScript(code));
        typeof callback === "function" && callback(null, pm.response);
      } catch (err) {
        console.log("eeeee", err);

        typeof callback === "function" && callback(err.toString());
      }
    }

    _.assign(this, {
      ...{ execute },
      ...{ getAllInsideVariables },
      ...{ getAllDynamicVariables },
      ...{ dynamicVariables },
      ...{ variablesScope },
      ...{ replaceIn },
    });
  };

  const mySandbox = new Sandbox();

  // 获取某接口的 所有父target
  function getParentTargetIDs(collection, target_id, parent_ids = []) {
    if (_.isArray(collection)) {
      const item = _.find(
        collection,
        _.matchesProperty("target_id", target_id)
      );

      if (item) {
        parent_ids.push(item.parent_id);
        getParentTargetIDs(collection, item.parent_id, parent_ids);
      }
    }

    return parent_ids;
  }

  // 获取某接口的详细信息
  function getItemFromCollection(collection, target_id) {
    return _.find(collection, _.matchesProperty("target_id", target_id));
  }

  // 参数初始化
  function runInit() {
    // RUNNER_ERROR_COUNT = 0;
    // RUNNER_TOTAL_COUNT = 0
    // startTime = dayjs().format("YYYY-MM-DD HH:mm:ss"); // 开始时间
    // startTimeStamp = Date.now(); // 开始时间戳
    RUNNER_RESULT_LOG = {};
  }
  // start run
  async function run(definitions, option = {}, initFlag = 0, loopCount = 0) {
    // console.log(mySandbox.variablesScope)
    option = _.assign(
      {
        project: {},
        collection: [], // 当前项目的所有接口列表
        environment: {}, // 当前环境变量
        globals: {}, // 当前公共变量
        iterationData: [], // 当前迭代的excel导入数据
        iterationCount: loopCount || 1, // 当前迭代次数
        ignoreError: 1, // 遇到错误忽略
        sleep: 0, // 每个任务的间隔时间
        requester: {}, // 发送模块的 options
      },
      option
    );

    let {
      RUNNER_REPORT_ID,
      scene,
      project,
      cookies,
      collection,
      iterationData,
      combined_id,
      test_events,
      default_report_name,
      user,
      env,
      env_name,
      env_pre_url,
      environment,
      globals,
      iterationCount,
      ignoreError,
      ignore_error,
      enable_sandbox,
      sleep,
      requester,
    } = option;

    if (typeof ignoreError === "undefined") {
      ignoreError = ignore_error ? !!ignore_error : 0;
    } else {
      ignoreError = !!ignoreError;
    }
    ignore_error = ignoreError ? 1 : 0;
    enable_sandbox =
      typeof enable_sandbox === "undefined" ? -1 : enable_sandbox; // fix bug

    if (typeof env === "undefined") {
      env = {
        env_name,
        env_pre_url,
      };
    } else {
      env_name = env.env_name;
      env_pre_url = env.env_pre_url;
    }

    if (initFlag == 0) {
      // 初始化参数
      if (_.size(RUNNER_RESULT_LOG) > 0) {
        // 当前有任务时，拒绝新任务
        return;
      }

      // 设置sandbox的 environment变量 和 globals 变量
      // fix bug for 7.0.8
      new Array("environment", "globals").forEach((func) => {
        if (
          _.isObject(option[func]) &&
          _.isObject(mySandbox.dynamicVariables[func]) &&
          _.isFunction(mySandbox.dynamicVariables[func].set)
        ) {
          for (const [key, value] of Object.entries(option[func])) {
            mySandbox.dynamicVariables[func].set(key, value, false);
          }
        }
      });

      // console.log(definitions, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      runInit();
      RUNNER_STOP[RUNNER_REPORT_ID] = 0;
      RUNNER_TOTAL_COUNT =
        typeof definitions[0] === "object"
          ? definitions[0].RUNNER_TOTAL_COUNT
          : 0;
      //RUNNER_RUNTIME_POINTER = 0;
      //initDefinitions = definitions;

      if (RUNNER_TOTAL_COUNT <= 0) {
        return;
      }
    }

    if (!_.isArray(iterationData)) {
      // fixed iterationData 兼容
      if (_.isObject(iterationData)) {
        const _interData = _.values(iterationData);
        if (_.isArray(_interData) && _.isArray(_interData[0])) {
          iterationData = _interData[0];
        } else {
          iterationData = [];
        }
      } else {
        iterationData = [];
      }
    }
    // console.log(iterationData);
    if (typeof iterationCount === "undefined") {
      iterationCount = loopCount || 1;
    }

    // 自动替换 Mock
    const AUTO_CONVERT_FIELD_2_MOCK =
      typeof requester === "object" && requester.AUTO_CONVERT_FIELD_2_MOCK > 0;

    // 发送对象
    const request = new apipostRequest(_.isObject(requester) ? requester : {});

    // 全局断言
    const _global_asserts = _.find(
      definitions,
      _.matchesProperty("type", "assert")
    );
    let _global_asserts_script = "";

    if (_global_asserts && _.has(_global_asserts, "data.content")) {
      _global_asserts_script = _global_asserts.data.content;
    }
    // console.log(iterationData);
    if (_.isArray(definitions) && definitions.length > 0) {
      for (let i = 0; i < definitions.length; i++) {
        const definition = definitions[i];
        // RUNNER_RUNTIME_POINTER

        _.assign(definition, {
          iteration_id: uuid.v4(), // 每次执行单任务的ID
          iteration: i,
          iterationData: iterationData[loopCount]
            ? iterationData[loopCount]
            : iterationData[0],
          ...{ iterationCount },
          ...{ env_name },
          ...{ env_pre_url },
          ...{ environment },
          ...{ globals },
        });

        if (_.isObject(definition.iterationData)) {
          for (const [key, value] of Object.entries(definition.iterationData)) {
            // console.log(key, value);
            mySandbox.dynamicVariables.iterationData.set(key, value, false);
          }
        }
        if (definition.type === "api") {
          definition.request = definition.data;
          if (_.has(definition, "request") && _.isObject(definition.request)) {
            let res = {};
            // 拼接全局参数、目录参数、以及脚本
            let _requestPara = {};
            let _parent_ids = _.reverse(
              getParentTargetIDs(collection, definition.request.target_id)
            );
            let _requestBody = getItemFromCollection(
              collection,
              definition.request.target_id
            );

            if (_requestBody && _.isObject(_requestBody)) {
              _.assign(definition.request, {
                url: definition.request.url
                  ? definition.request.url
                  : _requestBody.request.url,
                request: _.cloneDeep(_requestBody.request), // fix bug
              });

              _requestBody = null;
            }

            new Array(
              "header",
              "body",
              "query",
              "auth",
              "pre_script",
              "test",
              "resful"
            ).forEach((_type) => {
              // 参数
              if (
                _.indexOf(["header", "body", "query", "resful"], _type) > -1
              ) {
                if (typeof _requestPara[_type] === "undefined") {
                  _requestPara[_type] = _type == "header" ? {} : [];
                }

                // 全局参数
                if (
                  typeof project.request === "object" &&
                  _.isArray(project.request[_type])
                ) {
                  project.request[_type].forEach((item) => {
                    if (item.is_checked > 0 && _.trim(item.key) != "") {
                      if (_type == "header") {
                        _requestPara[_type][_.trim(item.key)] = item;
                      } else {
                        _requestPara[_type].push(item);
                      }
                    }
                  });
                }

                // 目录参数
                if (_.isArray(_parent_ids) && _parent_ids.length > 0) {
                  _parent_ids.forEach((parent_id) => {
                    const _folder = getItemFromCollection(
                      collection,
                      parent_id
                    );

                    if (
                      _.has(_folder, "request") &&
                      _.isArray(_folder.request[_type])
                    ) {
                      _folder.request[_type].forEach((item) => {
                        if (item.is_checked > 0 && _.trim(item.key) != "") {
                          if (_type == "header") {
                            _requestPara[_type][_.trim(item.key)] = item;
                          } else {
                            _requestPara[_type].push(item);
                          }
                        }
                      });
                    }
                  });
                }

                // 接口参数
                if (
                  _.has(definition, `request.request.${_type}.parameter`) &&
                  _.isArray(definition.request.request[_type].parameter)
                ) {
                  definition.request.request[_type].parameter.forEach(
                    (item) => {
                      if (item.is_checked > 0 && _.trim(item.key) != "") {
                        if (_type == "header") {
                          _requestPara[_type][_.trim(item.key)] = item;
                        } else {
                          _requestPara[_type].push(item);
                        }
                      }
                    }
                  );
                }
              }

              // 认证
              if (_.indexOf(["auth"], _type) > -1) {
                if (typeof _requestPara[_type] === "undefined") {
                  _requestPara[_type] = {};
                }

                // 全局认证
                if (
                  _.has(project, `request.['${_type}']`) &&
                  _.isObject(project.request[_type]) &&
                  project.request[_type].type != "noauth"
                ) {
                  _.assign(_requestPara[_type], project.request[_type]);
                }

                // 目录认证
                if (_.isArray(_parent_ids) && _parent_ids.length > 0) {
                  _parent_ids.forEach((parent_id) => {
                    const _folder = getItemFromCollection(
                      collection,
                      parent_id
                    );
                    // console.log(_folder);
                    if (
                      _.has(_folder, `request.['${_type}']`) &&
                      _.isObject(_folder.request[_type]) &&
                      _folder.request[_type].type != "noauth"
                    ) {
                      // console.log(_folder.request[_type]);
                      _.assign(_requestPara[_type], _folder.request[_type]);
                    }
                  });
                }

                // 接口认证
                if (
                  _.has(definition, `request.request.${_type}`) &&
                  _.isObject(definition.request.request[_type]) &&
                  definition.request.request[_type].type != "noauth"
                ) {
                  _.assign(
                    _requestPara[_type],
                    definition.request.request[_type]
                  );
                }
              }
              // console.log(_requestPara);
              // mySandbox.replaceIn(item.key, null, AUTO_CONVERT_FIELD_2_MOCK)

              // 脚本
              if (_.indexOf(["pre_script", "test"], _type) > -1) {
                if (typeof _requestPara[_type] === "undefined") {
                  _requestPara[_type] = "";
                }

                // 全局脚本， 已兼容旧版本
                if (
                  _.has(project, `script.['${_type}']`) &&
                  _.isString(project.script[_type]) &&
                  project.script[`${_type}_switch`] > 0
                ) {
                  _requestPara[
                    _type
                  ] = `${_requestPara[_type]}\r\n${project.script[_type]}`;
                } else if (
                  _.has(project, `request.script.['${_type}']`) &&
                  _.isString(project.request.script[_type]) &&
                  project.request.script[`${_type}_switch`] > 0
                ) {
                  _requestPara[
                    _type
                  ] = `${_requestPara[_type]}\r\n${project.request.script[_type]}`;
                }

                // 目录脚本
                if (_.isArray(_parent_ids) && _parent_ids.length > 0) {
                  _parent_ids.forEach((parent_id) => {
                    const _folder = getItemFromCollection(
                      collection,
                      parent_id
                    );

                    if (
                      _.has(_folder, `script.['${_type}']`) &&
                      _.isString(_folder.script[_type]) &&
                      _folder.script[`${_type}_switch`] > 0
                    ) {
                      _requestPara[
                        _type
                      ] = `${_requestPara[_type]}\r\n${_folder.script[_type]}`;
                    }
                  });
                }

                // 接口脚本
                if (
                  _.has(definition, `request.request.event.${_type}`) &&
                  _.isString(definition.request.request.event[_type])
                ) {
                  _requestPara[
                    _type
                  ] = `${_requestPara[_type]}\r\n${definition.request.request.event[_type]}`;
                }
              }
            });

            let _timeout = 0;
            if (
              _.has(option, "requester.timeout") &&
              _.isNumber(option.requester.timeout) &&
              option.requester.timeout >= 0
            ) {
              _timeout = option.requester.timeout;
            }

            // script_mode
            let _script_mode = "none";

            if (_.has(definition, "request.request.body.mode")) {
              _script_mode = definition.request.request.body.mode;
            }

            // script_header
            const _script_headers = [];
            _.forEach(_requestPara.header, (item) => {
              _script_headers.push(item);
            });

            // fix bug for 7.0.8
            const _script_request_headers_raw = request.formatRequestHeaders(
              _script_headers,
              _script_mode
            );
            const _script_request_headers = {};

            if (_.isPlainObject(_script_request_headers_raw)) {
              _.forEach(_script_request_headers_raw, function (value, key) {
                _script_request_headers[
                  mySandbox.replaceIn(key, null, AUTO_CONVERT_FIELD_2_MOCK)
                ] = mySandbox.replaceIn(value, null, AUTO_CONVERT_FIELD_2_MOCK);
              });
            }

            const _script_header_map = {
              urlencoded: "application/x-www-form-urlencoded",
              none: "",
              "form-data": "multipart/form-data",
            };

            // script_query
            const _script_querys = {};
            if (_.has(_requestPara, "query")) {
              _.forEach(
                request.formatQueries(_requestPara.query),
                (value, key) => {
                  // _script_querys[key] = value; // fix bug for 7.0.8
                  _script_querys[
                    mySandbox.replaceIn(key, null, AUTO_CONVERT_FIELD_2_MOCK)
                  ] = mySandbox.replaceIn(
                    value,
                    null,
                    AUTO_CONVERT_FIELD_2_MOCK
                  );
                }
              );
            }

            // script_body
            let _script_bodys = {};
            switch (_script_mode) {
              case "none":
                _script_bodys = "";
                break;
              case "form-data":
              case "urlencoded":
                if (
                  _.has(_requestPara, "body") &&
                  _.isArray(_requestPara.body)
                ) {
                  _requestPara.body.forEach((item) => {
                    if (parseInt(item.is_checked) > 0) {
                      _script_bodys[
                        mySandbox.replaceIn(
                          item.key,
                          null,
                          AUTO_CONVERT_FIELD_2_MOCK
                        )
                      ] = mySandbox.replaceIn(
                        item.value,
                        null,
                        AUTO_CONVERT_FIELD_2_MOCK
                      ); // fix bug
                    }
                  });
                }
                break;
              default:
                if (_.has(definition, "request.request.body.raw")) {
                  _script_bodys = mySandbox.replaceIn(
                    request.formatRawJsonBodys(
                      definition.request.request.body.raw
                    ),
                    null,
                    AUTO_CONVERT_FIELD_2_MOCK
                  );
                  // _script_bodys = mySandbox.replaceIn(definition.request.request.body.raw, null, AUTO_CONVERT_FIELD_2_MOCK); // fix bug
                } else {
                  _script_bodys = "";
                }
                break;
            }

            // script_request_para
            // 环境前缀 fix bug
            let _script_pre_url = mySandbox.replaceIn(
              env_pre_url,
              null,
              AUTO_CONVERT_FIELD_2_MOCK
            );
            let _script_url = mySandbox.replaceIn(
              definition.request.url,
              null,
              AUTO_CONVERT_FIELD_2_MOCK
            );

            // 拼接环境前置URl
            if (_.isString(_script_pre_url) && _script_pre_url.length > 0) {
              if (
                !_.startsWith(_.toLower(_script_pre_url), "https://") &&
                !_.startsWith(_.toLower(_script_pre_url), "http://")
              ) {
                _script_pre_url = `http://${_script_pre_url}`;
              }

              // _script_url = urlJoin(_script_pre_url, _script_url);
              _script_url = urljoins(_script_pre_url, _script_url); // fix bug for 7.0.8

              if (_.endsWith(_script_pre_url, "/")) {
                // fix bug
                _script_url = _.replace(
                  _script_url,
                  `${_script_pre_url}:`,
                  `${_script_pre_url.substr(0, _script_pre_url.length - 1)}:`
                );
              } else {
                _script_url = _.replace(
                  _script_url,
                  `${_script_pre_url}/:`,
                  `${_script_pre_url}:`
                );
              }
            } else if (
              !_.startsWith(_.toLower(_script_url), "https://") &&
              !_.startsWith(_.toLower(_script_url), "http://")
            ) {
              _script_url = `http://${_script_url}`;
            }

            const _request_para = {
              id: _.has(definition, "request.target_id")
                ? definition.request.target_id
                : "",
              name: _.has(definition, "request.name")
                ? definition.request.name
                : undefined,
              description: _.has(definition, "request.request.description")
                ? definition.request.request.description
                : undefined,
              url: _script_url,
              method: definition.request.method,
              timeout: _timeout,
              contentType: _script_request_headers["content-type"]
                ? _script_request_headers["content-type"]
                : _script_header_map[_script_mode]
                ? _script_header_map[_script_mode]
                : "",
              request_headers: _script_request_headers,
              request_querys: _script_querys,
              request_bodys: _script_bodys,
              data: _script_bodys,
              headers: _script_request_headers,
            };

            RUNNER_RESULT_LOG[definition.iteration_id] = {
              test_id: definition.test_id,
              report_id: RUNNER_REPORT_ID,
              parent_id: definition.parent_id,
              event_id: definition.event_id,
              iteration_id: definition.iteration_id,
              type: definition.type,
              target_id: definition.target_id,
              request: _request_para,
              response: {},
              http_error: -1,
              assert: [],
              datetime: dayjs().format("YYYY-MM-DD HH:mm:ss"),
            };

            // 执行预执行脚本
            _.set(definition, "script_request", _request_para); // fix bug

            if (
              _.has(_requestPara, "pre_script") &&
              _.isString(_requestPara.pre_script)
            ) {
              await mySandbox.execute(
                _requestPara.pre_script,
                definition,
                "pre_script",
                (err, res) => {}
              );
            }

            let _request = _.cloneDeep(definition.request);

            // 替换 _requestPara 的参数变量
            new Array("header", "query", "body", "resful").forEach((type) => {
              _requestPara[type] = _.values(_requestPara[type]);
              _requestPara[type].map((item) => {
                if (item.type == "File") {
                  _.assign(item, {
                    key: mySandbox.replaceIn(
                      item.key,
                      null,
                      AUTO_CONVERT_FIELD_2_MOCK
                    ),
                    value: item.value,
                  });
                } else {
                  _.assign(item, {
                    key: mySandbox.replaceIn(
                      item.key,
                      null,
                      AUTO_CONVERT_FIELD_2_MOCK
                    ),
                    value: mySandbox.replaceIn(
                      item.value,
                      null,
                      AUTO_CONVERT_FIELD_2_MOCK
                    ),
                  });
                }
              });

              if (type == "body" && _.has(_request, "request.body.raw")) {
                _request.request.body.raw = mySandbox.replaceIn(
                  _request.request.body.raw,
                  null,
                  AUTO_CONVERT_FIELD_2_MOCK
                );
              }

              _.set(_request, `request.${type}.parameter`, _requestPara[type]);
            });

            // 认证 fixed bug
            if (
              _.isObject(_requestPara.auth) &&
              _.isString(_requestPara.auth.type) &&
              _.isObject(_requestPara.auth[_requestPara.auth.type])
            ) {
              Object.keys(_requestPara.auth[_requestPara.auth.type]).forEach(
                (key) => {
                  _requestPara.auth[_requestPara.auth.type][key] =
                    mySandbox.replaceIn(
                      _requestPara.auth[_requestPara.auth.type][key],
                      null,
                      AUTO_CONVERT_FIELD_2_MOCK
                    );
                }
              );
            }

            // 重新渲染请求参数
            let _target = RUNNER_RESULT_LOG[definition.iteration_id];

            if (
              typeof _target === "object" &&
              _.isObject(_target.beforeRequest)
            ) {
              new Array("query", "header", "body").forEach((type) => {
                if (
                  _.has(_request, `request.${type}.parameter`) &&
                  _.isArray(_target.beforeRequest[type])
                ) {
                  _target.beforeRequest[type].forEach((_item) => {
                    if (_item.action == "set") {
                      if (_.isObject(_item.key) || _.isUndefined(_item.value)) {
                        // 允许直接修改请求体 new features
                        if (_.isArray(_request.request[type].parameter)) {
                          _request.request[type].parameter = [];
                          if (_.isObject(_item.key)) {
                            _.forEach(_item.key, (_set_value, _set_key) => {
                              _set_key = _.trim(_set_key);
                              if (_set_key != "") {
                                _request.request[type].parameter.push({
                                  description: "",
                                  field_type: "Text",
                                  is_checked: "1",
                                  key: mySandbox.replaceIn(
                                    _set_key,
                                    null,
                                    AUTO_CONVERT_FIELD_2_MOCK
                                  ),
                                  not_null: "1",
                                  type: "Text",
                                  value: mySandbox.replaceIn(
                                    _set_value,
                                    null,
                                    AUTO_CONVERT_FIELD_2_MOCK
                                  ),
                                });
                              }
                            });
                          }
                        }
                      } else if (_.isString(_item.key)) {
                        const _itemPara = _.find(
                          _request.request[type].parameter,
                          _.matchesProperty(
                            "key",
                            mySandbox.replaceIn(
                              _item.key,
                              null,
                              AUTO_CONVERT_FIELD_2_MOCK
                            )
                          )
                        );

                        if (_itemPara) {
                          _itemPara.value = mySandbox.replaceIn(
                            _item.value,
                            null,
                            AUTO_CONVERT_FIELD_2_MOCK
                          );
                        } else {
                          _request.request[type].parameter.push({
                            description: "",
                            field_type: "Text",
                            is_checked: "1",
                            key: mySandbox.replaceIn(
                              _item.key,
                              null,
                              AUTO_CONVERT_FIELD_2_MOCK
                            ),
                            not_null: "1",
                            type: "Text",
                            value: mySandbox.replaceIn(
                              _item.value,
                              null,
                              AUTO_CONVERT_FIELD_2_MOCK
                            ),
                          });
                        }
                      }
                    } else if (_item.action == "remove") {
                      _.remove(
                        _request.request[type].parameter,
                        _.matchesProperty(
                          "key",
                          mySandbox.replaceIn(
                            _item.key,
                            null,
                            AUTO_CONVERT_FIELD_2_MOCK
                          )
                        )
                      );
                    }
                  });
                }

                if (
                  type == "body" &&
                  _.has(_request, "request.body.raw") &&
                  aTools.isJson5(_request.request.body.raw) &&
                  _.isArray(_target.beforeRequest.body) &&
                  _target.beforeRequest.body.length > 0
                ) {
                  let _rawParse = null;

                  try {
                    _rawParse = JSONbig.parse(
                      stripJsonComments(_request.request.body.raw)
                    );
                  } catch (e) {
                    _rawParse = JSON5.parse(_request.request.body.raw);
                  }

                  if (_rawParse) {
                    _target.beforeRequest[type].forEach((_item) => {
                      if (_item.action == "set") {
                        if (
                          _.isObject(_item.key) ||
                          _.isUndefined(_item.value)
                        ) {
                          // 允许直接修改请求体 new features
                          if (_.isObject(_item.key)) {
                            _request.request.body.raw = _rawParse =
                              JSONbig.parse(
                                mySandbox.replaceIn(
                                  JSONbig.stringify(_item.key),
                                  null,
                                  AUTO_CONVERT_FIELD_2_MOCK
                                )
                              );
                          } else if (
                            _.isString(_item.key) ||
                            _.isNumber(_item.key)
                          ) {
                            _request.request.body.raw = _rawParse =
                              mySandbox.replaceIn(
                                String(_item.key),
                                null,
                                AUTO_CONVERT_FIELD_2_MOCK
                              ); // fix bug
                          }
                        } else if (_.isString(_item.key)) {
                          _.set(
                            _rawParse,
                            mySandbox.replaceIn(
                              _item.key,
                              null,
                              AUTO_CONVERT_FIELD_2_MOCK
                            ),
                            mySandbox.replaceIn(
                              _item.value,
                              null,
                              AUTO_CONVERT_FIELD_2_MOCK
                            )
                          );
                        }
                      } else if (_item.action == "remove") {
                        _.unset(
                          _rawParse,
                          mySandbox.replaceIn(
                            _item.key,
                            null,
                            AUTO_CONVERT_FIELD_2_MOCK
                          )
                        );
                      }
                    });

                    if (_.isObject(_rawParse)) {
                      _request.request.body.raw = JSONbig.stringify(_rawParse);
                    } else {
                      _request.request.body.raw = _rawParse;
                    }
                  }
                }
              });
            }

            if (_.isObject(_requestPara.auth[_requestPara.auth.type])) {
              _requestPara.auth[_requestPara.auth.type] = _.mapValues(
                _requestPara.auth[_requestPara.auth.type],
                (val) =>
                  mySandbox.replaceIn(val, null, AUTO_CONVERT_FIELD_2_MOCK)
              );
              // console.log(_request, _requestPara);
              _.set(_request, "request.auth.type", _requestPara.auth.type); // fix bug
              _.set(
                _request,
                `request.auth.${_requestPara.auth.type}`,
                _requestPara.auth[_requestPara.auth.type]
              );
            }

            // url 兼容
            let _url = _request.request.url
              ? _request.request.url
              : _request.url;
            _url = mySandbox.replaceIn(_url, null, AUTO_CONVERT_FIELD_2_MOCK);

            // fixed bug add 替换路径变量
            if (
              _.isArray(_requestPara.resful) &&
              _requestPara.resful.length > 0
            ) {
              _requestPara.resful.forEach((_resful) => {
                _resful.key = _.trim(_resful.key);

                if (_resful.is_checked > 0 && _resful.key !== "") {
                  _url = _.replace(_url, `:${_resful.key}`, _resful.value);
                }
              });
            }

            // 环境前缀 fix bug
            let _pre_url = mySandbox.replaceIn(
              env_pre_url,
              null,
              AUTO_CONVERT_FIELD_2_MOCK
            );

            // 拼接环境前置URl
            if (_.isString(_pre_url) && _pre_url.length > 0) {
              if (
                !_.startsWith(_.toLower(_pre_url), "https://") &&
                !_.startsWith(_.toLower(_pre_url), "http://")
              ) {
                _pre_url = `http://${_pre_url}`;
              }

              // _url = urlJoin(_pre_url, _url);
              _url = urljoins(_pre_url, _url); // fix bug for 7.0.8

              if (_.endsWith(_pre_url, "/")) {
                // fix bug
                _url = _.replace(
                  _url,
                  `${_pre_url}:`,
                  `${_pre_url.substr(0, _pre_url.length - 1)}:`
                );
              } else {
                _url = _.replace(_url, `${_pre_url}/:`, `${_pre_url}:`);
              }
            } else if (
              !_.startsWith(_.toLower(_url), "https://") &&
              !_.startsWith(_.toLower(_url), "http://")
            ) {
              _url = `http://${_url}`;
            }
            // _url=encodeURI(_url);
            _.set(_request, "url", _url);
            _.set(_request, "request.url", _url);

            let _isHttpError = -1;

            // cookie
            // 已修复 cookie 无法使用的问题
            if (
              typeof cookies === "object" &&
              _.has(cookies, "switch") &&
              _.has(cookies, "data")
            ) {
              if (cookies.switch > 0 && _.isArray(cookies.data)) {
                const _cookieArr = [];
                cookies.data.forEach((_cookie) => {
                  if (
                    typeof _cookie.name === "undefined" &&
                    typeof _cookie.key === "string"
                  ) {
                    _cookie.name = _cookie.key;
                  }
                  const cookieStr = validCookie.isvalid(_url, _cookie);

                  if (cookieStr) {
                    _cookieArr.push(cookieStr.cookie);
                  }
                });

                if (_cookieArr.length > 0) {
                  if (_.has(_request, "request.header.parameter")) {
                    const _targetHeaderCookie = _.find(
                      _request.request.header.parameter,
                      (o) => _.trim(_.toLower(o.key)) == "cookie"
                    );

                    if (
                      _targetHeaderCookie &&
                      _targetHeaderCookie.is_checked > 0
                    ) {
                      _targetHeaderCookie.value = `${_cookieArr.join(";")};${
                        _targetHeaderCookie.value
                      }`; // fix bug for 7.0.8
                    } else {
                      _request.request.header.parameter.push({
                        key: "cookie",
                        value: _cookieArr.join(";"), // fix cookie bug
                        description: "",
                        not_null: 1,
                        field_type: "String",
                        type: "Text",
                        is_checked: 1,
                      });
                    }
                  } else {
                    _.set(_request, "request.header.parameter", [
                      {
                        key: "cookie",
                        value: _cookieArr.join(";"), // fix cookie bug
                        description: "",
                        not_null: 1,
                        field_type: "String",
                        type: "Text",
                        is_checked: 1,
                      },
                    ]);
                  }
                }
              }
            }

            //如果是mock环境，则携带apipost_id
            if (`${option.env_id}` === "-2") {
              //判断query数组内是否包含apipost_id
              const requestApipostId = _request?.request?.query?.parameter.find(
                (item) => item.key === "apipost_id"
              );
              if (_.isUndefined(requestApipostId)) {
                _request.request.query.parameter.push({
                  key: "apipost_id",
                  value: _request.target_id.substr(0, 6),
                  description: "",
                  not_null: 1,
                  field_type: "String",
                  type: "Text",
                  is_checked: 1,
                });
              }
            }

            return _request;
          }
        }
      }
    }
  }

  // 构造一个执行对象
  Object.defineProperties(this, {
    run: {
      value: run,
    },
  });
}

// 格式化 query 参数
function formatQueries(arr) {
  let queries = "";

  if (arr instanceof Array) {
    arr.forEach(function (item) {
      // fixed bug
      if (parseInt(item.is_checked) === 1) {
        item.value;
        if (item.value === "") {
          queries += `${item.key}&`;
        } else {
          queries += `${item.key}=${item.value}&`;
        }
      }
    });
  }

  return qs.parse(_.trimEnd(queries, "&"));
}

// 格式化 urlencode 参数
function formatUrlencodeBodys(arr) {
  let bodys = "";

  if (arr instanceof Array) {
    arr.forEach(function (item) {
      if (parseInt(item.is_checked) === 1) {
        if (item.key !== "") {
          bodys +=
            encodeURIComponent(item.key) +
            "=" +
            encodeURIComponent(item.value) +
            "&"; // fix bug for 7.0.8
          // bodys += item.key + '=' + item.value + '&';
        }
      }
    });
  }

  bodys = bodys.substr(-1) == "&" ? bodys.substr(0, bodys.length - 1) : bodys;
  return bodys;
}

// 格式化 请求Body 参数
function formatRequestBodys(target) {
  let _body = {};

  switch (target.request.body.mode) {
    case "none":
      break;
    case "form-data":
      break;
    case "urlencoded":
      _body = {
        form: formatUrlencodeBodys(target.request.body.parameter),
      };
      break;
    case "json":
      _body = {
        body: formatRawJsonBodys(target.request.body.raw),
      };
      break;
    default:
      _body = {
        body: formatRawBodys(target.request.body.raw),
      };
      break;
  }

  return _body;
}

// 格式化 json 参数
function formatRawJsonBodys(raw = "") {
  let bodys = "";

  if (ATools.isJson5(raw)) {
    try {
      bodys = JSONbig.stringify(JSONbig.parse(stripJsonComments(raw)));
    } catch (e) {
      bodys = JSON.stringify(JSON5.parse(raw));
    }
  } else {
    bodys = raw;
  }

  return bodys;
}

function setQueryString(uri, paras) {
  let urls = new UrlParse(uri);
  let fullPath = urls.href.substr(urls.origin.length);
  let host = urls["host"];
  let baseUri = uri.substr(0, uri.indexOf(urls.query));

  if (urls.query !== "") {
    let queries = qs.parse(urls.query.substr(1));

    fullPath =
      urls["pathname"] + "?" + qs.stringify(Object.assign(queries, paras));
    uri = baseUri + "?" + qs.stringify(Object.assign(queries, paras));
  } else {
    fullPath += "?" + qs.stringify(paras);
    uri += "?" + qs.stringify(paras);
  }

  return { uri, host, fullPath, baseUri };
}

// 认证拼接为header
function createAuthHeaders(target) {
  let headers = {};
  let auth = target.request.auth;
  let { uri, host, fullPath, baseUri } = setQueryString(
    target.request.url,
    formatQueries(target.request.query.parameter)
  );
  let entityBody = "";
  let rbody = formatRequestBodys(target);

  if (target.request.body.mode == "urlencoded") {
    entityBody = rbody["form"];
  } else if (target.request.body.mode != "form-data") {
    entityBody = rbody["body"];
  }

  try {
    // fixed 修复可能因第三方包报错导致的 bug
    switch (auth.type) {
      case "noauth":
        break;
      case "kv":
        if (_.trim(auth.kv.key) != "") {
          headers[_.trim(auth.kv.key)] = auth.kv.value;
        }
        break;
      case "bearer":
        if (_.trim(auth.bearer.key) != "") {
          headers["Authorization"] = "Bearer " + _.trim(auth.bearer.key);
        }
        break;
      case "basic":
        headers["Authorization"] =
          "Basic " +
          Base64.encode(auth.basic.username + ":" + auth.basic.password);
        break;
      case "digest":
        let ha1 = "";
        let ha2 = "";
        let response = "";
        let hashFunc = CryptoJS.MD5;

        if (
          auth.digest.algorithm == "MD5" ||
          auth.digest.algorithm == "MD5-sess"
        ) {
          hashFunc = CryptoJS.MD5;
        } else if (
          auth.digest.algorithm == "SHA-256" ||
          auth.digest.algorithm == "SHA-256-sess"
        ) {
          hashFunc = CryptoJS.SHA256;
        } else if (
          auth.digest.algorithm == "SHA-512" ||
          auth.digest.algorithm == "SHA-512-sess"
        ) {
          hashFunc = CryptoJS.SHA512;
        }

        let cnonce = auth.digest.cnonce == "" ? "apipost" : auth.digest.cnonce;

        if (auth.digest.algorithm.substr(-5) == "-sess") {
          ha1 = hashFunc(
            hashFunc(
              auth.digest.username +
                ":" +
                auth.digest.realm +
                ":" +
                auth.digest.password
            ).toString() +
              ":" +
              auth.digest.nonce +
              ":" +
              cnonce
          ).toString();
        } else {
          ha1 = hashFunc(
            auth.digest.username +
              ":" +
              auth.digest.realm +
              ":" +
              auth.digest.password
          ).toString();
        }

        if (auth.digest.qop != "auth-int") {
          ha2 = hashFunc(target.method + ":" + fullPath).toString();
        } else if (auth.digest.qop == "auth-int") {
          ha2 = hashFunc(
            target.method +
              ":" +
              fullPath +
              ":" +
              hashFunc(entityBody).toString()
          ).toString();
        }

        if (auth.digest.qop == "auth" || auth.digest.qop == "auth-int") {
          response = hashFunc(
            ha1 +
              ":" +
              auth.digest.nonce +
              ":" +
              (auth.digest.nc || "00000001") +
              ":" +
              cnonce +
              ":" +
              auth.digest.qop +
              ":" +
              ha2
          ).toString();
        } else {
          response = hashFunc(
            ha1 + ":" + auth.digest.nonce + ":" + ha2
          ).toString();
        }

        headers["Authorization"] =
          'Digest username="' +
          auth.digest.username +
          '", realm="' +
          auth.digest.realm +
          '", nonce="' +
          auth.digest.nonce +
          '", uri="' +
          fullPath +
          '", algorithm="' +
          auth.digest.algorithm +
          '", qop=' +
          auth.digest.qop +
          ",nc=" +
          (auth.digest.nc || "00000001") +
          ', cnonce="' +
          cnonce +
          '", response="' +
          response +
          '", opaque="' +
          auth.digest.opaque +
          '"';
        break;
      case "hawk":
        let options = {
          ext: auth.hawk.extraData,
          timestamp: auth.hawk.timestamp,
          nonce: auth.hawk.nonce,
          // payload: '{"some":"payload"}',                      // UTF-8 encoded string for body hash generation (ignored if hash provided)
          // contentType: 'application/json',                    // Payload content-type (ignored if hash provided)
          // hash: false,
          app: auth.hawk.app,
          dlg: auth.hawk.delegation,
        };

        if (auth.hawk.algorithm === "") {
          auth.hawk.algorithm = "sha256";
        }

        if (auth.hawk.authId !== "" && auth.hawk.authKey !== "") {
          // fix bug
          let { header } = Hawk.client.header(uri, target.method, {
            credentials: {
              id: auth.hawk.authId,
              key: auth.hawk.authKey,
              algorithm: auth.hawk.algorithm,
            },
            ...options,
          });
          headers["Authorization"] = header;
        }
        break;
      case "awsv4":
        let awsauth = aws4.sign(
          {
            method: target.method,
            host: host,
            path: fullPath,
            service: auth.awsv4.service,
            region: auth.awsv4.region,
            body: entityBody,
          },
          {
            accessKeyId: auth.awsv4.accessKey,
            secretAccessKey: auth.awsv4.secretKey,
            sessionToken: auth.awsv4.sessionToken,
          }
        );

        Object.assign(headers, awsauth.headers);
        break;
      case "edgegrid":
        let eg = EdgeGridAuth.generateAuth(
          {
            path: uri,
            method: target.method,
            headers: {},
            body: entityBody,
          },
          auth.edgegrid.clientToken,
          auth.edgegrid.clientSecret,
          auth.edgegrid.accessToken,
          auth.edgegrid.baseUri,
          0,
          auth.edgegrid.nonce,
          auth.edgegrid.timestamp
        );

        Object.assign(headers, eg.headers);
        break;
      case "ntlm": // https://github.com/SamDecrock/node-http-ntlm
        Object.assign(headers, {
          Connection: "keep-alive",
          Authorization: ntlm.createType1Message({
            url: uri,
            username: auth.ntlm.username,
            password: auth.ntlm.password,
            workstation: auth.ntlm.workstation,
            domain: auth.ntlm.domain,
          }),
        });
        break;

      case "ntlm_close":
        Object.assign(headers, {
          Connection: "close",
          Authorization: ntlm.createType3Message(auth.ntlm_close.type2msg, {
            url: uri,
            username: auth.ntlm.username,
            password: auth.ntlm.password,
            workstation: auth.ntlm.workstation,
            domain: auth.ntlm.domain,
          }),
        });
        break;
      case "oauth1":
        let hmac = "sha1";

        if (auth.oauth1.signatureMethod === "HMAC-SHA1") {
          hmac = "sha1";
        } else if (auth.oauth1.signatureMethod === "HMAC-SHA256") {
          hmac = "sha256";
        } else if (auth.oauth1.signatureMethod === "HMAC-SHA512") {
          hmac = "sha512";
        } else {
          // todo..
          // 支持更多加密方式
        }
        const oauth = OAuth({
          consumer: {
            key: auth.oauth1.consumerKey,
            secret: auth.oauth1.consumerSecret,
            version: auth.oauth1.version ?? "1.0",
            nonce: auth.oauth1.nonce,
            realm: auth.oauth1.realm,
            timestamp: auth.oauth1.timestamp,
            includeBodyHash: auth.oauth1.includeBodyHash,
          },
          signature_method: auth.oauth1.signatureMethod,
          hash_function(base_string, key) {
            let hash = crypto
              .createHmac(hmac, key)
              .update(base_string)
              .digest("base64");
            return hash;
          },
        });

        const request_data = {
          url: uri,
          method: target.method,
          data: auth.oauth1.includeBodyHash ? entityBody : {},
          oauth_callback: auth.oauth1.callback,
        };

        // console.log(request_data)
        const token = {
          key: auth.oauth1.token,
          secret: auth.oauth1.tokenSecret,
        };

        Object.assign(
          headers,
          oauth.toHeader(oauth.authorize(request_data, token))
        );
        break;
    }
  } catch (e) {
    console.log(e, "error");
  }

  return headers;
}

// 格式化 其他 非json raw参数
function formatRawBodys(raw = '') {
    let bodys = raw;

    // if(ATools.isJson5(raw)){
    //     bodys = JSON.stringify(JSON5.parse(raw));
    // }else{
    //     bodys = raw;
    // }

    return bodys;
}
module.exports = { ApipostPreRequest, createAuthHeaders };
