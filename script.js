var spacex = angular.module('spacex', []);

spacex.config(['$sceDelegateProvider', function($sceDelegateProvider) {
	$sceDelegateProvider.resourceUrlWhitelist(['self', /http:\/\/dz0bwiwndcjbh\.cloudfront\.net/ ]);
}]);

spacex.directive('enterSubmit', [function () {
	return {
		link: function($scope, element, attributes) {
			element.bind('keydown', function(e) {
				if (e.which == 13) {
					$scope.$apply(function() {
						$scope.parseMMB();
					});
				}
			});
		}
	};
} ]);

spacex.directive('macroblockSelector', ['$compile', function ($compile) {
	return {
		link: function ($scope, element, attributes) {
			element.bind('click', function (event) {
				var imgTop = Math.floor((event.pageY - $(this).offset().top) / 16);
				var imgLeft = Math.floor((event.pageX - $(this).offset().left) / 16);

				blockSelected.show().css({
					top: imgTop * 16,
					left: imgLeft * 16
				});

				$scope.$apply(function () {
					$scope.data.selectedMacroBlock = {
						x: imgLeft,
						y: imgTop
					};
				});
			});

			$scope.$watch('data', function (newVal, oldVal) {
				if (newVal.selectedMacroBlock) {
					blockSelected.show().css({
						top: newVal.selectedMacroBlock.y * 16,
						left: newVal.selectedMacroBlock.x * 16
					});
				} else {
					blockSelected.hide();
				}
			}, true);

			var blockCursor = $compile('<div id="imgCursor"></div>')($scope);
			var blockSelected = $compile('<div id="selectedBlock"></div>')($scope);

			element.append(blockSelected);
			element.append(blockCursor);

			element.bind('mouseenter', function (event) {
				blockCursor.show();
			});

			element.bind('mouseleave', function (event) {
				blockCursor.hide();
			});

			element.bind('mousemove', function (event) {
				var imgTop = Math.floor((event.pageY - element.offset().top) / 16);
				var imgLeft = Math.floor((event.pageX - element.offset().left) / 16);

				blockCursor.css({
					top: imgTop * 16,
					left: imgLeft * 16
				});
			});
		},
		scope: {
			data: '=macroblockSelector'
		}
	};
} ]);



spacex.factory('imgService', ['$http', '$q', function ($http, $q) {
	var basePath = 'http://dz0bwiwndcjbh.cloudfront.net';

	return {
		getVersion: function () {
			return $http({
				method: 'GET',
				url: basePath + '/v'
			}).then(function (result) {
				return result.data.version;
			});
		},
		getFrameSet: function () {
			return $http({
				method: 'GET',
				url: './data.json'
			}).then(function (result) {
				return result.data.frameSets;
			});
		},
		getFrameInfo: function (selectedFrameSet, selectedFrame, version, mmb) {
			return $http({
				method: 'GET',
				url: basePath + '/info/' + selectedFrameSet + '/' + selectedFrame + '?v=' + version + '&mmb=' + mmb
			}).then(function (result) {
				return result.data;
			});
		}
	};
} ]);

spacex.factory("preloader", function ($q, $rootScope) {
	function Preloader(imageLocations) {
		this.imageLocations = imageLocations;

		this.imageCount = this.imageLocations.length;
		this.loadCount = 0;
		this.errorCount = 0;

		this.states = {
			PENDING: 1,
			LOADING: 2,
			RESOLVED: 3,
			REJECTED: 4
		};

		this.state = this.states.PENDING;

		this.deferred = $q.defer();
		this.promise = this.deferred.promise;

	}
	
	Preloader.preloadImages = function (imageLocations) {
		var preloader = new Preloader(imageLocations);
		return (preloader.load());
	};

	Preloader.prototype = {
		constructor: Preloader,
		isInitiated: function isInitiated() {
			return (this.state !== this.states.PENDING);
		},
		isRejected: function isRejected() {
			return (this.state === this.states.REJECTED);
		},
		isResolved: function isResolved() {
			return (this.state === this.states.RESOLVED);
		},
		load: function load() {
			if (this.isInitiated()) {
				return (this.promise);
			}
			
			this.state = this.states.LOADING;
			
			for (var i = 0; i < this.imageCount; i++) {
				this.loadImageLocation(this.imageLocations[i]);
			}
			return (this.promise);
		},
		handleImageError: function handleImageError(imageLocation) {
			this.errorCount++;
			
			if (this.isRejected()) {
				return;
			}
			
			this.state = this.states.REJECTED;
			this.deferred.reject(imageLocation);
		},
		handleImageLoad: function handleImageLoad(imageLocation) {
			this.loadCount++;
			
			if (this.isRejected()) {
				return;
			}
			
			this.deferred.notify({
				percent: Math.ceil(this.loadCount / this.imageCount * 100),
				imageLocation: imageLocation
			});
			
			if (this.loadCount === this.imageCount) {
				this.state = this.states.RESOLVED;
				this.deferred.resolve(this.imageLocations);
			}
		},
		
		loadImageLocation: function loadImageLocation(imageLocation) {
			var preloader = this;
			var image = $(new Image()).load(function (event) {
				$rootScope.$apply(function () {
					preloader.handleImageLoad(event.target.src);
					preloader = image = event = null;
				});
			}).error(function (event) {
				$rootScope.$apply(function () {
					preloader.handleImageError(event.target.src);
					preloader = image = event = null;
				});
			}).prop("src", imageLocation);
		}
	};
	return (Preloader);
});


function AppController($scope, $q, imgService, preloader) {
	$scope.loaded = false;
	$scope.lastCommandChanged = null;

	$q.all([
			imgService.getVersion(),
			imgService.getFrameSet()]).then(function(result) {
				$scope.version = result[0];
				$scope.frameSet = result[1];
				$scope.loaded = true;
			});

	$scope.data = {
		mmb: '',
		selectedFrameSet: null,
		selectedFrame: null,
		globalOperations: [],
		macroBlockOperations: [],
		globalOperationToAdd: null,
		selectedMacroBlock: null,
		currentImageInfo: []
	};
	
	$scope.$watch('data.selectedFrameSet', function (newVal, oldVal) {
		if (!newVal || newVal !== oldVal) {
			$scope.data.selectedFrame = null;
		}
	}, true);

	$scope.$watch('data.selectedFrame', function (newVal, oldVal) {
		if (newVal !== oldVal) {
			if (newVal.defaultMmb) {
				$scope.data.mmb = newVal.defaultMmb || '';
			} else {
				$scope.data.mmb = '';
			}

			$scope.parseMMB();
			$scope.updateImage();
		}
	});

	$scope.$watch('data.mmb', function (newVal, oldVal) {
		if ($scope.data.mmbForced) {
			$scope.data.mmbForced = false;
		} else {
			if (newVal !== oldVal) {
				$scope.parseMMB();
			}
		}
	});

	$scope.parseMMB = function() {
		$scope.data.globalOperations = [];
		$scope.data.macroBlockOperations = [];
		var parts = $scope.data.mmb == null ? '' : $scope.data.mmb.split(',');

		for (var i = 0; i < parts.length; i++) {
			parseMMBPart(parts[i].replace(' ', ''));
		}
		$scope.updateImage();
	};

	$scope.updateImage = function () {
		var mmb = getMMBString();

		if ($scope.data.mmb != mmb) {
			$scope.data.mmb = mmb;
			$scope.data.mmbForced = true;
		}

		if (!$scope.data.selectedFrame) {
			$scope.imagePath = null;
			return;
		}

		var url = generateURL(mmb);

		if ($scope.imagePath !== url) {
			if (!url) {
				$scope.imagePath = null;
				return;
			}

			$scope.showSpinner = true;

			preloader.preloadImages([url]).then(function () {
				$scope.imagePath = url;
				$scope.showSpinner = false;
			});

			imgService.getFrameInfo($scope.data.selectedFrameSet.id, $scope.data.selectedFrame.id, $scope.version, mmb).then(function (result) {
				$scope.data.frameLog = result;
				parseInfo(result);
			});

			if ($scope.lastCommandChanged && $scope.lastCommandChanged.preload) {
				var readaheadMMB = getMMBString(1);
				preloader.preloadImages([generateURL(readaheadMMB)]);
			}
		}
	};

	function generateURL(mmb) {
		if (mmb) {
			mmb = '&mmb=' + mmb;
		}

		return 'http://dz0bwiwndcjbh.cloudfront.net/' + $scope.data.selectedFrameSet.id + '/' + $scope.data.selectedFrame.id + '?v=' + $scope.version + mmb;
	};

	var mbOp = /^([0-9]+):([0-9]+):(-1|-2|[0-9]+)(?::(-?[0-9]+)?)?(?::(-?[0-9]+)?)?(?::(-?[0-9]+)?)?(?::(-?[0-9]+)?)?(?::(-?[0-9]+)?)?(?::(-?[0-9]+)?)?$/ ;
	var reXor = /^x:([0-9]+):([0-9a-f]{1,2})$/i ;

	function parseMMBPart(op) {
		if (mbOp.test(op)) {
			var matches = mbOp.exec(op);
			var x = parseInt(matches[1]);
			var y = parseInt(matches[2]);
			var pos = parseInt(matches[3]);

			var op = {
				__type: 'macro_block_op',
				x: x,
				y: y,
				pos: pos
			};

			if (matches[4]) {
				op.l1 = parseInt(matches[4]);
			}

			if (matches[5]) {
				op.l2 = parseInt(matches[5]);
			}

			if (matches[6]) {
				op.l3 = parseInt(matches[6]);
			}
			if (matches[7]) {
				op.l4 = parseInt(matches[7]);
			}

			if (matches[8]) {
				op.c1 = parseInt(matches[8]);
			}

			if (matches[9]) {
				op.c2 = parseInt(matches[9]);
			}

			if (!$scope.data.macroBlockOperations[y]) {
				$scope.data.macroBlockOperations[y] = [];
			}

			if ($scope.data.macroBlockOperations[y][x]) {
				op.__visible = $scope.data.macroBlockOperations[y][x].__visible;
			}
			
			$scope.data.macroBlockOperations[y][x] = op;
		} else if (reXor.test(op)) {
			var matches = reXor.exec(op);
			var pos = parseInt(matches[1]);
			var mask = matches[2];

			$scope.data.globalOperations.push({
				__type: 'xor_bitpos',
				pos: pos,
				mask: mask
			});
		}
	}

	function pad(num) {
		var s = num + "";
		while (s.length < 2) s = "0" + s;
		return s;
	}

	function getMMBString(readaheadIndex) {
		readaheadIndex = readaheadIndex || 0;
		var mmb = [];

		angular.forEach($scope.data.globalOperations, function(op, i) {
			if (op.__type == 'xor_bitpos') {
				var pos = op.pos;
				if (op == $scope.lastCommandChanged.op && $scope.lastCommandChanged) {
					pos += $scope.lastCommandChanged.delta*readaheadIndex;
				};
				mmb.push('X:' + pos + ':' + op.mask);
			};
		});

		angular.forEach($scope.data.macroBlockOperations, function (row, l) {
			if (row) {
				angular.forEach(row, function (op, c) {
					if (op) {
						if (op.__type == 'macro_block_op') {
							var components = [l, c, op.pos, op.l1, op.l2, op.l3, op.l4, op.c1, op.c2];
							if (op == $scope.lastCommandChanged.op) {
								for (var i = 0; i < components.length; i++) {
									if (components[i] && $scope.lastCommandChanged) {
										components[i] += $scope.lastCommandChanged.delta[i] * readaheadIndex;
									}
								};
							}
							var command = components.join(":");
							mmb.push(command.replace(new RegExp(":+$"), ""));
						};
					};
				});
			}
		});

		return mmb.join(",");
	}

	$scope.$watch('data.globalOperations', function (newVal, oldVal) {
		removeEmptyMacroblocks();
		if (allOperationsValid()) {
			$scope.updateImage();
		}
	}, true);

	$scope.$watch('data.macroBlockOperations', function (newVal, oldVal) {
		if (allOperationsValid()) {
			$scope.updateImage();
		}
	}, true);

	function allOperationsValid() {
		for (x = 0; x < $scope.data.globalOperations.length; x++) {
			if ($scope.data.globalOperations[x].__type == 'xor_bitpos') {
				if (isNaN(parseInt($scope.data.globalOperations[x].pos)) || parseInt($scope.data.globalOperations[x].pos) < 0) {
					$scope.data.globalOperations[x].__valid = false;
					return false;
				}

				if (! /^[0-9a-f]{1,2}$/i .test($scope.data.globalOperations[x].mask)) {
					$scope.data.globalOperations[x].__valid = false;
					return false;
				}

				$scope.data.globalOperations[x].__valid = true;
			}
		}

		for (y = 0; y < $scope.data.macroBlockOperations.length; y++) {
		
			if (!$scope.data.macroBlockOperations[y]) {
				continue;
			}

			for (x = 0; x < $scope.data.macroBlockOperations[y].length; x++) {
				if (!$scope.data.macroBlockOperations[y][x]) {
					continue;
				}

				if ($scope.data.macroBlockOperations[y][x].__type == 'macro_block_op') {
					
					if (parseInt($scope.data.macroBlockOperations[y][x].x) < 0) {
						$scope.data.macroBlockOperations[y][x].__valid = false;
						return false;
					}

					if (parseInt($scope.data.macroBlockOperations[y][x].y) < 0) {
						$scope.data.macroBlockOperations[y][x].__valid = false;
						return false;
					}

					if (isNaN(parseInt($scope.data.macroBlockOperations[y][x].pos)) || parseInt($scope.data.macroBlockOperations[y][x].pos) < -2) {
						$scope.data.macroBlockOperations[y][x].__valid = false;
						return false;
					}

					if ($scope.data.macroBlockOperations[y][x].l1 != undefined && $scope.data.macroBlockOperations[y][x].l1 != null && isNaN(parseInt($scope.data.macroBlockOperations[y][x].l1))) {
						$scope.data.macroBlockOperations[y][x].__valid = false;
						return false;
					}

					if ($scope.data.macroBlockOperations[y][x].l2 != undefined && $scope.data.macroBlockOperations[y][x].l2 != null && isNaN(parseInt($scope.data.macroBlockOperations[y][x].l2))) {
						$scope.data.macroBlockOperations[y][x].__valid = false;
						return false;
					}

					if ($scope.data.macroBlockOperations[y][x].l3 != undefined && $scope.data.macroBlockOperations[y][x].l3 != null && isNaN(parseInt($scope.data.macroBlockOperations[y][x].l3))) {
						$scope.data.macroBlockOperations[y][x].__valid = false;
						return false;
					}

					if ($scope.data.macroBlockOperations[y][x].l4 != undefined && $scope.data.macroBlockOperations[y][x].l4 != null && isNaN(parseInt($scope.data.macroBlockOperations[y][x].l4))) {
						$scope.data.macroBlockOperations[y][x].__valid = false;
						return false;
					}

					if ($scope.data.macroBlockOperations[y][x].c1 != undefined && $scope.data.macroBlockOperations[y][x].c1 != null && isNaN(parseInt($scope.data.macroBlockOperations[y][x].c1))) {
						$scope.data.macroBlockOperations[y][x].__valid = false;
						return false;
					}

					if ($scope.data.macroBlockOperations[y][x].c2 != undefined && $scope.data.macroBlockOperations[y][x].c2 != null && isNaN(parseInt($scope.data.macroBlockOperations[y][x].c2))) {
						$scope.data.macroBlockOperations[y][x].__valid = false;
						return false;
					}

					$scope.data.macroBlockOperations[y][x].__valid = true;
				}
			}
		}

		return true;
	}

	$scope.addInvertBits = function () {
		removeEmptyMacroblocks();
		$scope.data.globalOperations.push({
			__type: 'xor_bitpos',
			mask: '1'
		});
	};

	$scope.getMacroblockOperations = function () {
		var ret = [];

		for (y = 0; y < $scope.data.macroBlockOperations.length; y++) {
			if (!$scope.data.macroBlockOperations[y]) {
				continue;
			}

			for (x = 0; x < $scope.data.macroBlockOperations[y].length; x++) {
				if (!$scope.data.macroBlockOperations[y][x]) {
					continue;
				}

				ret.push($scope.data.macroBlockOperations[y][x]);
			}
		}

		return ret;
	};

	$scope.showMb = function (op) {
		for (y = 0; y < $scope.data.macroBlockOperations.length; y++) {
			if (!$scope.data.macroBlockOperations[y]) {
				continue;
			}

			for (x = 0; x < $scope.data.macroBlockOperations[y].length; x++) {
				if (!$scope.data.macroBlockOperations[y][x]) {
					continue;
				}

				$scope.data.macroBlockOperations[y][x].__visible = false;
			}
		}

		op.__visible = true;
		
		$scope.data.selectedMacroBlock = {
			x: op.x,
			y: op.y
		};
	};

	$scope.removeGlobalOp = function (op) {
		if ($scope.data.globalOperations.indexOf(op) > -1) {
			$scope.data.globalOperations.splice($scope.data.globalOperations.indexOf(op), 1);	
		}
	};

	$scope.removeMb = function (op) {
		if (!$scope.data.macroBlockOperations[op.y]) {
			return;
		}

		if (!$scope.data.macroBlockOperations[op.y][op.x]) {
			return;
		}

		$scope.data.macroBlockOperations[op.y][op.x] = undefined;
	};
	
	function removeEmptyMacroblocks() {
		// Remove any completely empty macroblock operations
		for (y = 0; y < $scope.data.macroBlockOperations.length; y++) {
			if (!$scope.data.macroBlockOperations[y]) {
				continue;
			}

			for (x = 0; x < $scope.data.macroBlockOperations[y].length; x++) {
				if (!$scope.data.macroBlockOperations[y][x]) {
					continue;
				}

				if ($scope.data.macroBlockOperations[y][x].__type == 'macro_block_op') {
					if ($scope.data.macroBlockOperations[y][x].pos != null && $scope.data.macroBlockOperations[y][x].pos != '') {
						continue;
					}

					if ($scope.data.macroBlockOperations[y][x].l1 != null && $scope.data.macroBlockOperations[y][x].l1 != '') {
						continue;
					}

					if ($scope.data.macroBlockOperations[y][x].l2 != null && $scope.data.macroBlockOperations[y][x].l2 != '') {
						continue;
					}

					if ($scope.data.macroBlockOperations[y][x].l3 != null && $scope.data.macroBlockOperations[y][x].l3 != '') {
						continue;
					}

					if ($scope.data.macroBlockOperations[y][x].l4 != null && $scope.data.macroBlockOperations[y][x].l4 != '') {
						continue;
					}

					if ($scope.data.macroBlockOperations[y][x].c1 != null && $scope.data.macroBlockOperations[y][x].c1 != '') {
						continue;
					}

					if ($scope.data.macroBlockOperations[y][x].c2 != null && $scope.data.macroBlockOperations[y][x].c2 != '') {
						continue;
					}

					$scope.data.macroBlockOperations[y][x] = undefined;
				}
			}
		}
	}

	$scope.$watch('data.selectedMacroBlock', function (newVal) {
		removeEmptyMacroblocks();

		if(!newVal) {
			return;
		}

		for (y = 0; y < $scope.data.macroBlockOperations.length; y++) {
			if (!$scope.data.macroBlockOperations[y]) {
				continue;
			}

			for (x = 0; x < $scope.data.macroBlockOperations[y].length; x++) {
				if (!$scope.data.macroBlockOperations[y][x]) {
					continue;
				}

				$scope.data.macroBlockOperations[y][x].__visible = false;
			}
		}

		if (!$scope.data.macroBlockOperations[newVal.y]) {
			$scope.data.macroBlockOperations[newVal.y] = [];
		}

		if (!$scope.data.macroBlockOperations[newVal.y][newVal.x]) {
			$scope.data.macroBlockOperations[newVal.y][newVal.x] = {
				__type: 'macro_block_op',
				__visible: true,
				x: newVal.x,
				y: newVal.y
			};
		} else {
			$scope.data.macroBlockOperations[newVal.y][newVal.x].__visible = true;
		}
	});

	var infoRe = /MB pos\/size: (-?[0-9]) ([0-9]+):([0-9]+):([0-9]+) ([0-9]+)/;
	
	function parseInfo(info) {
		var lines = info.split('\n');
		$scope.data.currentImageInfo = [];
		for (var i = 0; i < lines.length; i++) {
			if (infoRe.test(lines[i])) {
				var match = infoRe.exec(lines[i]);
				var s = parseInt(match[1]);
				var x = parseInt(match[2]);
				var y = parseInt(match[3]);
				var pos = parseInt(match[4]);
				var len = parseInt(match[5]);

				if (!$scope.data.currentImageInfo[y]) {
					$scope.data.currentImageInfo[y] = [];
				}

				$scope.data.currentImageInfo[y][x] = {
					s: s,
					pos: pos,
					len: len
				};
			}
		}
	}

	$scope.getMBLogInfo = function (x, y) {
		if (!$scope.data.currentImageInfo[y]) {
			return '';
		}

		if (!$scope.data.currentImageInfo[y][x]) {
			return '';
		}

		var block = $scope.data.currentImageInfo[y][x];

		return 'MB pos/size: ' + block.s + ' ' + pad(x) + ':' + pad(y) + ':' + block.pos + ' ' + block.len;
	};

	$scope.$on("commandChanged", function (event) {
		var lastCommandChanged = event.targetScope;
		$scope.lastCommandChanged = lastCommandChanged;
	});
}

spacex.controller('InvertBitsController', function ($scope) {
	$scope.$watch('op.pos', function (newValue, oldValue) {
		var delta = newValue-oldValue;
		$scope.preload = Math.abs(delta)==1;
                $scope.delta = delta;
		$scope.$emit("commandChanged");
	});
});

spacex.controller('MacroblockController', function ($scope) {
	$scope.$watchCollection('[op.x, op.y, op.pos, op.l1, op.l2, op.l3, op.l4, op.c1, op.c2]', function (newValues, oldValues) {
		var preload = false;
		var deltas = [];
		for(var i=0; i<newValues.length; i++) {
			var delta = newValues[i]-oldValues[i] || 0;
			preload = preload || Math.abs(delta)==1;
			deltas.push(delta);
		};
		$scope.preload = preload;
		$scope.delta = deltas;
		$scope.$emit("commandChanged");
	});
});
