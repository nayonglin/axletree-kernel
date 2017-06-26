'use strict';
/**
 ** @author: kekobin@163.com
 ** @file 根据配置动态初始化路由
 **{
 **	"demo": {
 **		"pages": [
 **			{
 **				"page": "index", //页面名称，对应访问的路由和html
 **				"urls": [
 **					{
 **						"name": "", //api名称，在模版中对请求结果的引用
 **						"url":""
 **					}
 **				],
 **				"cache": true//是否缓存(debug模式下无效)
 **			}
 **		]
 **	}
 **}
 **/
var async = require('async');
var path = require('path');
var express = require('express');
var router = express.Router();
var multiparty = require('multiparty');
var fs = require('fs-extra');
var request = require('./request');
var Cache = require('./cache');
var uploadError = false;
var expiresGap = 60000; //数据缓存有效期

function initRouter(debug, ROOT_PATH) {
	var apiConf = require(ROOT_PATH + '/config/apiConf');

	async.forEach(Object.keys(apiConf), function (appName, done){ 
	    var appConf = apiConf[appName],
			pages = appConf.pages;
			
		pages.forEach(function(pageItem) {
			var urls = pageItem['urls'],
				page = pageItem['page'],
				cacheData = pageItem['cache'],
				urlPrefix = debug || cacheData ? '/' : '/live/',//debug模式下都不缓存
				routeUrl = urlPrefix + appName + '/' + page;

			router.get(routeUrl, function(req, res, next) {
				var proCache = Cache.get(appName),
					proData = proCache.data,
					pagePath = ROOT_PATH + '/views/' + page;

				//判断当前项目数据是否在有效缓存中,debug模式下都不缓存
				if (!debug && cacheData && proData && (Date.now() - proCache.expires) < expiresGap) {
					proData.yyuid = req.cookies.yyuid;
					// res.render(path.join(__dirname, '../views/' + page), proData);
					res.render(pagePath, proData);
				} else {
					request(req, urls, function(data) {
						//添加缓存信息到缓存系统
						Cache.set(appName, data);

						//根据这个在页面中判断是否登录
						data.yyuid = req.cookies.yyuid;
						res.render(pagePath, data);
						// res.render(path.join(__dirname, '../views/' + page), data);
					});
				}
			});
		});

	    done(); 
	}, function(err) {
	    console.log('iterating done');
	});
}

module.exports = function(debug, ROOT_PATH) {
	//reload config
	if (debug) {
		router.get('/axletree/upload', function(req, res) {
			res.end(req.protocol + '://' + req.get('host') + '/axletree/upload is ready to work');
		});

		router.post('/axletree/upload', function(req, res, next) {
			console.log('resources upload!')
			if (uploadError) {
				return next(new Error('fs error'));
			}
			var goNext = function(err) {
				return next(err);
			};
			// parse a file upload
			var form = new multiparty.Form();
			form.parse(req, function(err, fields, files) {
				if (err) return goNext(err);
				if (!files.file || !files.file[0]) return goNext(new Error('invalid upload file'));
				res.end('0');
				// record uploading app,注意这里的路径一定需要是绝对路径
				fs.move(
					files.file[0].path, ROOT_PATH + fields.to, {
						clobber: true
					},
					function(err) {
						if (err) {
							uploadError = true;
						}
					}
				);
			});
		});
	}

	initRouter(debug, ROOT_PATH);

	return router;
};