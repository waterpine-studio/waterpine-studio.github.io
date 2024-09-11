/*
    Copyright (C) 2009-2010, 2013, Ewe, YS (Team Water)

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

Animation.prototype = new Entity();
function Animation() {
  this.m_frame = 1;
  this.m_maxFrame;
  this.m_currentFrame = 1;
}

Explosion.prototype = new Animation();
function Explosion() {
  var tx = 0;
  this.InitExplosion = function (x, y, radius, image, maxFrame) {
    this.x = x;
    this.y = y;
    this.m_radius = radius * 2;
    this.offset = -radius;
    this.m_image = image;
    this.m_id = g_world.count++;
    this.m_alive = 1;
    this.m_maxFrame = maxFrame;
  };
  this.Draw = function () {
    g_context.setTransform(1, 0, 0, 1, this.x, this.y);
    g_context.drawImage(
      this.m_image,
      tx,
      0,
      this.m_radius,
      this.m_radius,
      this.offset,
      this.offset,
      this.m_radius,
      this.m_radius
    );
    this.m_frame++;
    if (this.m_frame > FRAME_RATE) {
      tx += this.m_radius;
      this.m_currentFrame++;
      this.m_frame = 0;
    }
    if (this.m_currentFrame == this.m_maxFrame) {
      this.Sleep();
    }
  };
}

function Controller() {
  this.m_ship;
  this.m_down;
  this.SetShip = function (ship) {
    this.m_down = false;
    this.m_ship = ship;
  };
  this.Down = function () {
    this.m_down = true;
  };
  this.QueryDownStatus = function () {
    return this.m_down;
  };
}

P1Controller.prototype = new Controller();
function P1Controller() {
  var prevShot = 0;
  var m_playerNo;
  this.OnUpdate = function () {
    if (this.m_ship.QueryAlive()) {
      if (input.UP) {
        this.m_ship.Accelerate(1);
      }
      if (input.RIGHT) {
        this.m_ship.Steer(0.1);
      } else if (input.LEFT) {
        this.m_ship.Steer(-0.1);
      }
      if (input.SHOOT && !prevShot) {
        this.m_ship.Shoot();
      }
      prevShot = input.SHOOT;
    }
  };
}

AIController.prototype = new Controller();
function AIController() {
  this.m_id;
  this.m_target;
  this.m_shootCoolDown = 0;
  this.m_retreatPoint;
  this.m_aiType;
  this.m_state;
  this.m_toRotate;
  this.InitAIController = function (ship, type, id) {
    this.m_down = false;
    this.m_ship = ship;
    this.m_aiType = type;
    this.m_state = this.StateNavigate;
    this.m_id = id * 32;
  };
  this.MarkTarget = function (target) {
    this.m_target = target;
    this.m_target.Tag();
  };
  this.UnmarkTarget = function () {
    if (this.m_target) {
      this.m_target.Untag();
      this.m_target = 0;
    }
  };
  this.OnUpdate = function () {
    if (this.m_ship.QueryAlive()) {
      this.m_state();
    } else {
      this.UnmarkTarget();
      this.Down();
    }
    this.DebugOut();
  };
  this.SeekPosition = function (tx, ty) {
    var target = new Vector2();
    target.Set(tx, ty);
    var angle = GetVectorAngle(
      this.m_ship.x,
      this.m_ship.y,
      target.x,
      target.y
    );
    target.Add(this.SplitShip());
    angle = GetVectorAngle(this.m_ship.x, this.m_ship.y, target.x, target.y);
    this.m_ship.Pilot(1, angle);
  };
  this.GetDirection = function (tx, ty) {
    var newX = tx - this.m_ship.x;
    var newY = ty - this.m_ship.y;
    var radAngle = Math.atan(newY / newX) + HALF_PI;
    if (newX < 0) radAngle += PI;
    this.m_ship.SetRotation(radAngle);
  };
  this.SplitShip = function () {
    var result = new Vector2();
    result.Set(0, 0);
    var thieves = g_world.m_thiefs;
    for (var i = thieves.length; i--; ) {
      var ship = thieves[i];
      if (this.m_ship.m_id == ship.m_id) continue;
      var toNeighbour = new Vector2();
      toNeighbour.Set(ship.x - this.m_ship.x, ship.y - this.m_ship.y);
      var dist = toNeighbour.Length();
      if (dist < (ship.m_radius + this.m_ship.m_radius) * 2) {
        toNeighbour.Normalise();
        toNeighbour.Div(dist);
        result.Add(toNeighbour);
      }
    }
    return result;
  };
  this.SelectNearest = function (list) {
    var selected = list[0];
    var minLength = DistanceSq(
      this.m_ship.x,
      this.m_ship.y,
      selected.x,
      selected.y
    );
    for (var i = 1; i < list.length; i++) {
      var entity = list[i];
      length = DistanceSq(this.m_ship.x, this.m_ship.y, entity.x, entity.y);
      if (length < minLength) {
        selected = entity;
        minLength = length;
      }
    }
    return selected;
  };
  this.Sensed = function (my, target, sensor, radius) {
    if (Distance(my.x, my.y, target.x, target.y) < sensor + radius) return true;
    return false;
  };
  this.StateNavigate = function () {
    var allDiamonds = g_world.m_diamonds;
    var untagDiamonds = [];
    for (var i = allDiamonds.length; i-- > 0; ) {
      var diamond = allDiamonds[i];
      if (!diamond.QueryTag()) {
        untagDiamonds.push(diamond);
      }
    }
    var alivePlayers = g_world.m_players;
    var untagPlayers = [];
    for (var i = alivePlayers.length; i-- > 0; ) {
      var player = alivePlayers[i];
      if (player.QueryAlive()) {
        untagPlayers.push(player);
      }
    }
    switch (this.m_aiType) {
      case TheifBehave.THIEF:
        if (untagDiamonds.length > 0) {
          var nearestDiamond = this.SelectNearest(untagDiamonds);
          nearestDiamond.Tag();
          this.m_state = this.StateFoundDiamond;
          this.MarkTarget(nearestDiamond);
        } else {
          this.m_aiType = TheifBehave.FIGHTER;
        }
        break;
      case TheifBehave.FIGHTER:
        if (untagPlayers.length > 0) {
          var nearestPlayer = this.SelectNearest(untagPlayers);
          this.m_state = this.StateFoundPlayer;
          this.MarkTarget(nearestPlayer);
        } else {
          this.m_aiType = TheifBehave.THIEF;
          this.m_state = this.StateNavigate;
        }
        break;
    }
    this.SeekPosition(DimViewCentral.x, DimViewCentral.y);
    this.debugMsg = "Navigate";
  };
  this.StateFoundDiamond = function () {
    if (
      Distance(this.m_ship.x, this.m_ship.y, this.m_target.x, this.m_target.y) <
      this.m_ship.m_radius
    ) {
      this.m_retreatPoint = new Vector2();
      this.m_retreatPoint.x = this.m_ship.x;
      if (this.m_ship.y > DimViewCentral.y)
        this.m_retreatPoint.y = DimView.bottom;
      else this.m_retreatPoint.y = DimView.top;
      this.m_state = this.StateHookDiamond;
      return;
    }
    this.SeekPosition(this.m_target.x, this.m_target.y);
    this.debugMsg = "FoundDiamond";
  };
  this.StateHookDiamond = function () {
    var distance = GetVectorAngle(
      this.m_ship.x,
      this.m_ship.y,
      this.m_retreatPoint.x,
      this.m_retreatPoint.y
    );
    var delta = Math.abs(distance - this.m_ship.m_rotation);
    if (delta < 0.1 && delta > -0.1) {
      this.m_target.Hook(this.m_ship);
      this.m_state = this.StateRunWithDiamond;
    }
    this.m_ship.Pilot(0, distance);
    this.debugMsg = "HookDiamond";
  };
  this.StateRunWithDiamond = function () {
    var distance = Distance(
      this.m_ship.x,
      this.m_ship.y,
      this.m_retreatPoint.x,
      this.m_retreatPoint.y
    );
    if (distance <= this.m_ship.m_radius) {
      this.m_state = this.StateMissionComplete;
      return;
    }
    this.SeekPosition(this.m_retreatPoint.x, this.m_retreatPoint.y);
    this.debugMsg = "RunWithDiamond";
  };
  this.StateFoundPlayer = function () {
    if (
      this.Sensed(
        this.m_ship,
        this.m_target,
        this.m_ship.m_sensorRange,
        this.m_target.m_radius
      )
    ) {
      this.m_state = this.StateAttack;
    }
    this.SeekPosition(this.m_target.x, this.m_target.y);
    this.debugMsg = "FoundPlayer";
  };
  this.StateAttack = function () {
    if (this.m_target.QueryAlive()) {
      this.m_ship.ShootRequest();
      this.SeekPosition(this.m_target.x, this.m_target.y);
    } else {
      this.m_ship.CancelShootRequest();
      if (this.m_aiType == TheifBehave.FIGHTER) {
        this.m_aiType = TheifBehave.THIEF;
        this.m_state = this.StateNavigate;
      } else {
      }
    }
    this.debugMsg = "Attack";
  };
  this.StateMissionComplete = function () {
    this.m_ship.Sleep();
    this.m_target.Sleep();
    this.Down();
    this.debugMsg = "MissionComplete";
  };
  this.debugMsg = "Patrol";
  this.DebugOut = function () {};
}

function Entity() {
  this.x = 0;
  this.y = 0;
  this.m_type;
  this.m_id;
  this.m_image;
  this.m_radius;
  this.offset;
  this.m_alive;
  this.m_tag;
  this.InitEntity = function (x, y, radius, image) {
    this.x = x;
    this.y = y;
    this.m_radius = radius;
    this.offset = -radius;
    this.m_image = image;
    this.m_id = g_world.count++;
    this.m_alive = 1;
    this.m_tag = false;
  };
  this.OnUpdate = function (stepSize) {};
  this.Draw = function () {
    g_context.setTransform(1, 0, 0, 1, this.x, this.y);
    g_context.drawImage(this.m_image, this.offset, this.offset);
  };
  this.Sleep = function () {
    this.m_alive = false;
  };
  this.Wake = function () {
    this.m_alive = true;
  };
  this.QueryAlive = function () {
    return this.m_alive;
  };
  this.HasCollided = function (target) {
    if (!this.m_alive || !target.m_alive) return false;
    if (this.m_id == target.m_id) return false;
    if (
      Distance(this.x, this.y, target.x, target.y) <
      this.m_radius + target.m_radius
    )
      return true;
    return false;
  };
  this.Tag = function () {
    this.m_tag = true;
  };
  this.Untag = function () {
    this.m_tag = false;
  };
  this.QueryTag = function () {
    return this.m_tag;
  };
  this.OnCollide = function (entity) {};
}

RigidBody.prototype = new Entity();
function RigidBody() {
  this.m_mass = 1;
  this.m_drag = 0.8;
  this.m_velocity;
  this.m_rotation = 0;
  this.c = 1;
  this.s = 0;
  this.m_totalForce;
  this.m_maxSpeed;
  this.InitRigidBody = function (x, y, radius, image) {
    this.InitEntity(x, y, radius, image);
    this.m_totalForce = new Vector2();
    this.m_velocity = new Vector2();
    this.SetRotation(0);
  };
  this.SetRotation = function (rotation) {
    this.m_rotation = rotation;
    this.c = Math.cos(this.m_rotation);
    this.s = Math.sin(this.m_rotation);
  };
  this.Rotate = function (rotation) {
    rotation += this.m_rotation;
    if (rotation > TWO_PI) rotation -= TWO_PI;
    else if (rotation < 0) rotation += TWO_PI;
    this.SetRotation(rotation);
  };
  this.Move = function (stepSize) {
    if (this.m_totalForce.Length() < EPSILON) {
      var l = this.m_velocity.Length();
      if (this.m_drag > l) {
        this.m_velocity.Zero();
      } else {
        var newSpeed = l - this.m_drag * stepSize;
        this.UpdateVelocity(l, newSpeed);
      }
    } else {
      var step = stepSize / this.m_mass;
      this.m_velocity.Update(
        this.m_totalForce.x * step,
        -this.m_totalForce.y * step
      );
    }
    var length = this.m_velocity.Length();
    if (length > this.m_maxSpeed) {
      this.UpdateVelocity(length, this.m_maxSpeed);
    }
    this.x += this.m_velocity.x * stepSize;
    this.y += this.m_velocity.y * stepSize;
    this.m_totalForce.Zero();
  };
  this.UpdateVelocity = function (length, speed) {
    if (length > EPSILON) {
      speed /= length;
    } else {
      speed /= EPSILON;
    }
    this.m_velocity.Mul(speed);
  };
  this.Draw = function () {
    if (this.QueryAlive()) {
      g_context.setTransform(this.c, this.s, -this.s, this.c, this.x, this.y);
      g_context.drawImage(this.m_image, this.offset, this.offset);
    }
  };
}

Ship.prototype = new RigidBody();
function Ship() {
  this.m_bullets;
  this.m_speed;
  this.Accelerate = function (accelerate) {
    this.m_totalForce.Update(
      accelerate * this.m_speed * this.s,
      accelerate * this.m_speed * this.c
    );
  };
  this.Steer = function (rotation) {
    this.Rotate(rotation);
  };
}

GuardianShip.prototype = new Ship();
function GuardianShip() {
  var m_respawnTime = 60;
  this.m_respawnPoint;
  this.m_respawnRotation;
  this.m_respawnTimer;
  this.InitGuardianShip = function (x, y, radius, image) {
    this.InitRigidBody(x, y, radius, image);
    this.m_type = Entity.PLAYER_SHIP;
    this.m_respawnPoint = new Vector2();
    this.m_respawnPoint.Set(x, y);
    this.m_respawnRotation = PI + HALF_PI;
    this.m_bullets = new Array();
    for (var i = PLAYER_BULLET_COUNT; i-- > 0; ) {
      this.m_bullets.push(g_world.SpawnBullet(Entity.PLAYER_BULLET));
    }
    this.m_speed = PLAYER_SPEED;
    this.m_maxSpeed = SHIP_MAX_SPEED;
    this.Sleep();
  };
  this.Shoot = function () {
    for (var i = PLAYER_BULLET_COUNT; i-- > 0; ) {
      var bullet = this.m_bullets[i];
      if (!bullet.QueryAlive()) {
        bullet.x = this.x;
        bullet.y = this.y;
        bullet.SetRotation(this.m_rotation);
        bullet.m_velocity.Set(
          bullet.m_speed * bullet.s,
          bullet.m_speed * -bullet.c
        );
        bullet.Wake();
        break;
      }
    }
  };
  this.OnUpdate = function (stepSize) {
    if (!this.QueryAlive()) {
      this.m_respawnTimer++;
      if (this.m_respawnTimer > m_respawnTime) {
        this.Spawn();
      }
    }
  };
  this.OnCollide = function (entity) {
    if (
      entity.m_type == Entity.ENEMY_SHIP ||
      entity.m_type == Entity.ENEMY_BULLET
    ) {
      this.Kill();
      g_world.AddExplosion(this.x, this.y);
    }
  };
  this.OnOutOfBounds = function () {
    if (this.x > DimView.right) {
      this.x = DimView.right;
      this.m_velocity.x = -this.m_velocity.x;
    } else if (this.x < DimView.left) {
      this.x = DimView.left;
      this.m_velocity.x = -this.m_velocity.x;
    }
    if (this.y > DimView.bottom) {
      this.y = DimView.bottom;
      this.m_velocity.y = -this.m_velocity.y;
    } else if (this.y < DimView.top) {
      this.y = DimView.top;
      this.m_velocity.y = -this.m_velocity.y;
    }
  };
  this.Kill = function () {
    this.Sleep();
    this.m_respawnTimer = 0;
  };
  this.Spawn = function () {
    this.x = this.m_respawnPoint.x;
    this.y = this.m_respawnPoint.y;
    this.m_velocity.Zero();
    this.m_totalForce.Zero();
    this.SetRotation(this.m_respawnRotation);
    this.Wake();
  };
}

TheftShip.prototype = new Ship();
function TheftShip() {
  this.m_isPiloting;
  this.m_pilotRotation;
  this.m_pilotAcceleration;
  this.m_steerRate;
  this.m_shootRequest;
  this.m_shootCoolDown;
  this.m_sensorRange;
  this.InitTheftShip = function (x, y, radius, image, level) {
    this.InitRigidBody(x, y, radius, image);
    this.m_bullets = new Array();
    this.m_type = Entity.ENEMY_SHIP;
    this.m_maxSpeed = THEIF_MAX_SPEED[level];
    this.m_speed = THEIF_SPEED[level];
    this.m_isPiloting = false;
    this.m_pilotRotation = 0;
    this.m_shootRequest = false;
    this.m_steerRate = 0.1;
    this.m_shootCoolDown = SHIP_SHOOT_RATE;
    this.m_sensorRange = THEIF_SENSOR * radius;
  };
  this.Pilot = function (accelerate, rotation) {
    this.m_isPiloting = true;
    this.m_pilotAcceleration = accelerate;
    this.m_pilotRotation = rotation;
  };
  this.StopPilot = function () {
    this.m_isPiloting = false;
  };
  this.OnUpdate = function (stepSize) {
    if (this.m_isPiloting) {
      this.Accelerate(this.m_pilotAcceleration);
      var distance = this.m_pilotRotation - this.m_rotation;
      if ((distance > 0.1 && distance < PI) || distance < -PI) {
        this.Steer(this.m_steerRate);
      } else if (distance < -0.1 || distance > PI) {
        this.Steer(-this.m_steerRate);
      }
    }
    if (this.m_shootRequest) {
      this.m_shootCoolDown++;
      if (this.m_shootCoolDown > SHIP_SHOOT_RATE) {
        this.Shoot();
        this.m_shootCoolDown = 0;
        this.m_shootRequest = false;
      }
    }
  };
  this.Shoot = function () {
    var bullet = g_world.SpawnBullet(Entity.ENEMY_BULLET);
    bullet.x = this.x;
    bullet.y = this.y;
    bullet.SetRotation(this.m_rotation);
    bullet.m_velocity.Set(
      bullet.m_speed * bullet.s,
      bullet.m_speed * -bullet.c
    );
    bullet.Wake();
    this.m_bullets.push(bullet);
  };
  this.OnCollide = function (entity) {
    if (
      entity.m_type == Entity.PLAYER_SHIP ||
      entity.m_type == Entity.PLAYER_BULLET
    ) {
      this.Kill();
      g_world.AddExplosion(this.x, this.y);
    }
  };
  this.OnOutOfBounds = function () {};
  this.Kill = function () {
    this.Sleep();
  };
  this.ShootRequest = function () {
    this.m_shootRequest = true;
  };
  this.CancelShootRequest = function () {
    this.m_shootRequest = false;
  };
}

Bullet.prototype = new RigidBody();
function Bullet() {
  this.InitBullet = function (x, y, radius, image, type) {
    this.InitRigidBody(x, y, radius, image);
    this.m_type = type;
    this.m_drag = 0;
    this.m_speed = BULLET_SPEED;
    this.m_maxSpeed = BULLET_SPEED;
  };
  this.OnCollide = function (entity) {
    if (
      this.m_type == Entity.PLAYER_BULLET &&
      entity.m_type == Entity.ENEMY_SHIP
    ) {
      g_world.Score();
      this.Sleep();
    } else if (
      this.m_type == Entity.ENEMY_BULLET &&
      entity.m_type == Entity.PLAYER_SHIP
    ) {
      this.Sleep();
    }
  };
  this.OnOutOfBounds = function () {
    this.Sleep();
  };
}

Diamond.prototype = new RigidBody();
function Diamond() {
  this.m_hooker;
  this.InitDiamond = function (x, y, radius, image, type) {
    this.InitRigidBody(x, y, radius, image);
    this.m_type = type;
    this.m_hook = false;
  };
  this.OnUpdate = function (stepSize) {
    if (this.m_hooker) {
      this.SetRotation(this.m_hooker.m_rotation);
      this.x = this.m_hooker.x;
      if (this.m_hooker.y > DimViewCentral.y)
        this.y = this.m_hooker.y - DIAMOND_RADIUS;
      else this.y = this.m_hooker.y + DIAMOND_RADIUS;
    }
  };
  this.Hook = function (hooker) {
    this.m_hooker = hooker;
  };
  this.Untag = function () {
    this.m_tag = false;
    this.m_hooker = 0;
  };
  this.OnOutOfBounds = function () {
    this.Sleep();
  };
}

function ImageManager() {
  this.m_backgroundImg = new Image();
  this.m_playerImg = new Image();
  this.m_bulletImg = new Image();
  this.m_explosionImg = new Image();
  this.m_thiefImg = new Image();
  this.m_diamondImg = new Image();
  this.Init = function () {
    this.m_playerImg.src =
      "img/player.png";
    this.m_bulletImg.src =
      "img/bullet.png";
    this.m_explosionImg.src =
      "img/explosion.png";
    this.m_thiefImg.src =
      "img/thief.png";
    this.m_diamondImg.src =
      "img/diamond.png";
  };
}

var g_imageManager = new ImageManager();
var g_world = new World();
var g_states = new States();
var g_canvas = null;
var g_context = null;

function Start() {
  var shell = new Shell();
  shell.Init();
  shell.Run();
}

var EPSILON = 0.00000001;
var PI = 3.142;
var TWO_PI = PI * 2;
var HALF_PI = PI / 2;
var COS45 = 0.7071;
var COS60 = 0.5;
var COS30 = 0.866;

function Rand(min, max) {
  return Math.floor(Math.random() * max + min + 1);
}

function LengthSq(x, y) {
  return x * x + y * y;
}

function Length(x, y) {
  return Math.sqrt(LengthSq(x, y));
}

function DistanceSq(mx, my, tx, ty) {
  var lenX = tx - mx;
  var lenY = ty - my;
  return lenX * lenX + lenY * lenY;
}

function Distance(mx, my, tx, ty) {
  return Math.sqrt(DistanceSq(mx, my, tx, ty));
}

this.GetVectorAngle = function (mx, my, tx, ty) {
  var newX = tx - mx;
  var newY = ty - my;
  var radAngle = Math.atan(newY / newX) + HALF_PI;
  if (newX < 0) radAngle += PI;
  return radAngle;
};

function Vector2() {
  this.x = 0;
  this.y = 0;
  this.Zero = function () {
    this.x = 0;
    this.y = 0;
  };
  this.Set = function (x, y) {
    this.x = x;
    this.y = y;
  };
  this.Update = function (x, y) {
    this.x += x;
    this.y += y;
  };
  this.Add = function (vector) {
    this.x += vector.x;
    this.y += vector.y;
  };
  this.Mul = function (c) {
    this.x *= c;
    this.y *= c;
  };
  this.Div = function (c) {
    this.x /= c;
    this.y /= c;
  };
  this.LengthSq = function () {
    return this.x * this.x + this.y * this.y;
  };
  this.Length = function () {
    return Math.sqrt(this.LengthSq());
  };
  this.DistanceSq = function (target) {
    var lenX = target.x - this.x;
    var lenY = target.y - this.y;
    return lenX * lenX + lenY * lenY;
  };
  this.Distance = function (target) {
    return Math.sqrt(this.DistanceSq(target));
  };
  this.DistanceSq = function (x, y) {
    var lenX = x - this.x;
    var lenY = y - this.y;
    return lenX * lenX + lenY * lenY;
  };
  this.Distance = function (x, y) {
    return Math.sqrt(this.DistanceSq(x, y));
  };
  this.Normalise = function () {
    var l = this.Length();
    if (l < EPSILON) {
      l = EPSILON;
    }
    this.x /= l;
    this.y /= l;
  };
}

var Entity = {
  PLAYER_SHIP: 0,
  PLAYER_BULLET: 1,
  ENEMY_SHIP: 2,
  ENEMY_BULLET: 3,
  DIAMOND: 4,
  EXPLOSION: 5,
};

function OutOfBound(entity) {
  if (entity.y + entity.m_radius > DimView.bottom) return 1;
  if (entity.x + entity.m_radius > DimView.right) return 1;
  if (entity.x - entity.m_radius < DimView.left) return 1;
  if (entity.y - entity.m_radius < DimView.top) return 1;
  return 0;
}

function CollideEntity(entity1, entity2) {
  if (entity2.x > entity1.x + DimSprite.x) return 0;
  if (entity2.x + DimSprite.x < entity1.x) return 0;
  if (entity2.y > entity1.y + DimSprite.y) return 0;
  if (entity2.y + DimSprite.y < entity1.y) return 0;
  return 1;
}

function PhysicsWorld() {
  var m_entities = [];
  var m_collisionPair = [0, 0, 0, 0];
  this.AddCollisionPair = function (id1, id2) {
    m_collisionPair[id1] |= 1 << id2;
    m_collisionPair[id2] |= 1 << id1;
  };
  this.CanCollide = function (id1, id2) {
    return (m_collisionPair[id1] & (1 << id2)) != 0;
  };
  this.AddPhysicsEntity = function (entity) {
    m_entities.push(entity);
  };
  this.Clear = function () {
    for (var i = m_entities.length; i--; ) m_entities.pop();
  };
  this.OnUpdate = function (stepSize) {
    for (var i = m_entities.length; i-- > 0; ) {
      var entity = m_entities[i];
      entity.OnUpdate(stepSize);
      if (entity.QueryAlive()) {
        entity.Move(stepSize);
        if (OutOfBound(entity)) {
          entity.OnOutOfBounds();
        }
        entity.Draw();
      } else {
        if (
          entity.m_type == Entity.ENEMY_SHIP ||
          entity.m_type == Entity.DIAMOND ||
          entity.m_type == Entity.ENEMY_BULLET
        )
          m_entities.splice(i, 1);
      }
    }
    for (var i = m_entities.length; i-- > 0; ) {
      var entity1 = m_entities[i];
      for (var j = i; j-- > 0; ) {
        var entity2 = m_entities[j];
        if (
          this.CanCollide(entity1.m_type, entity2.m_type) &&
          entity1.HasCollided(entity2)
        ) {
          entity1.OnCollide(entity2);
          entity2.OnCollide(entity1);
        }
      }
    }
  };
}

var DimClient = { x: 0, y: 0 };
var DimView = { top: 0, bottom: 0, left: 0, right: 0 };
var DimViewCentral = { x: 0, y: 0 };
var MAX_RATE = 4;
var FRAME_RATE = 4;
var PLAYER_SPEED = 1;
var SHIP_MAX_SPEED = 8;
var THEIF_SPEED = [0.2, 0.5, 0.8, 1];
var THEIF_MAX_SPEED = [3, 5, 7, 8];
var THEIF_SENSOR = 8;
var BULLET_SPEED = 10;
var SHIP_RADIUS = 32;
var DIAMOND_RADIUS = 16;
var BULLET_RADIUS = 8;
var EXPLOSION_RADIUS = 32;
var HOOK_POSITION = DIAMOND_RADIUS;
var PHASE_PER_ROUND = 8;
var SHIP_SHOOT_RATE = 60;
var PLAYER_BULLET_COUNT = 6;
var LEVELING = [10, 25, 50, 0];
var SPAWN_OFFSET = SHIP_RADIUS * 3;
var SPAWN_RATE = 36;
var Action = { HOOK: 0, ATTACK: 1 };
var TheifBehave = { THIEF: 0, FIGHTER: 1, AGGRESSIVE: 2 };
var keys = {
  W: 87,
  A: 65,
  S: 83,
  D: 68,
  LEFT: 37,
  RIGHT: 39,
  UP: 38,
  DOWN: 40,
  SPACE: 32,
  ENTER: 13,
  PGUP: 33,
  PGDN: 34,
  END: 35,
  HOME: 36,
  SHIFT: 16,
  CTRL: 17,
  ESCAPE: 27,
  F5: 116,
};
var mouse = { LEFT: 0, MIDDLE: 1, RIGHT: 2 };
var input = {
  X: 0,
  Y: 0,
  LEFT: 0,
  RIGHT: 0,
  UP: 0,
  DOWN: 0,
  SHOOT: 0,
  START: 0,
  END: 0,
  CF1: 0,
  CF2: 0,
  CF3: 0,
  CF4: 0,
  CF5: 0,
  CF6: 0,
};

function Shell() {
  this.Init = function () {
    window.addEventListener("resize", this.Resize, false);
    g_canvas = document.getElementById("main_canvas");
    if (g_canvas) {
      g_canvas.addEventListener("keydown", this.KeyDown);
      g_canvas.addEventListener("keyup", this.KeyUp);
      g_canvas.addEventListener("mousedown", this.MouseDown);
      g_canvas.addEventListener("mouseup", this.MouseUp);
      g_canvas.addEventListener("touchstart", this.TouchStart);
      g_canvas.addEventListener("touchend", this.TouchEnd);
      g_canvas.addEventListener("touchmove", this.TouchMove);
      g_canvas.setAttribute("tabindex", "0");
      g_canvas.focus();
      g_context = g_canvas.getContext("2d");
      this.Resize();
      g_states.Init();
    }
  };
  this.Resize = function () {
    var w = window.innerWidth * 0.99;
    var h = window.innerHeight * 0.95;
    g_canvas.width = w;
    g_canvas.height = h;
    AspectRatio = w / h;
    DimClient.x = w;
    DimClient.y = h;
    DimView.bottom = DimClient.y;
    DimView.right = DimClient.x;
    DimViewCentral.x = (DimView.right - DimView.left) / 2;
    DimViewCentral.y = (DimView.bottom - DimView.top) / 2;
  };
  this.Run = function () {
    if (g_context != null) setInterval(this.Frame, 23);
  };
  this.Frame = function () {
    g_context.clearRect(0, 0, g_canvas.width, g_canvas.height);
    g_context.save();
    g_states.m_currentState();
    g_context.restore();
  };
  this.KeyUp = function (e) {
    switch (e.keyCode) {
      case keys.W:
      case keys.UP:
        input.UP = 0;
        break;
      case keys.S:
      case keys.DOWN:
        input.DOWN = 0;
        break;
      case keys.A:
      case keys.LEFT:
        input.LEFT = 0;
        break;
      case keys.D:
      case keys.RIGHT:
        input.RIGHT = 0;
        break;
      case keys.SPACE:
        input.SHOOT = 0;
        break;
      case keys.ENTER:
        input.START = 0;
        break;
      case keys.ESCAPE:
        input.END = 0;
        break;
      case keys.PGUP:
        input.CF1 = 0;
        break;
      case keys.PGDN:
        input.CF2 = 0;
        break;
      case keys.HOME:
        input.CF3 = 0;
        break;
      case keys.END:
        input.CF4 = 0;
        break;
      case keys.SHIFT:
        input.CF5 = 0;
        break;
      case keys.CTRL:
        input.CF6 = 0;
        break;
    }
  };
  this.KeyDown = function (e) {
    switch (e.keyCode) {
      case keys.F5:
        return;
        break;
      case keys.W:
      case keys.UP:
        input.UP = 1;
        input.DOWN = 0;
        break;
      case keys.S:
      case keys.DOWN:
        input.DOWN = 1;
        input.UP = 0;
        break;
      case keys.A:
      case keys.LEFT:
        input.LEFT = 1;
        input.RIGHT = 0;
        break;
      case keys.D:
      case keys.RIGHT:
        input.RIGHT = 1;
        input.LEFT = 0;
        break;
      case keys.SPACE:
        input.SHOOT = 1;
        break;
      case keys.ENTER:
        input.START = 1;
        break;
      case keys.ESCAPE:
        input.END = 1;
        break;
      case keys.PGUP:
        input.CF1 = 1;
        break;
      case keys.PGDN:
        input.CF2 = 1;
        break;
      case keys.HOME:
        input.CF3 = 1;
        break;
      case keys.END:
        input.CF4 = 1;
        break;
      case keys.SHIFT:
        input.CF5 = 1;
        break;
      case keys.CTRL:
        input.CF6 = 1;
        break;
    }
    e.preventDefault();
  };
  this.MouseDown = function (e) {
    if (e.button == mouse.LEFT) {
      input.SHOOT = 1;
      input.X = e.clientX;
      input.Y = e.clientY;
    }
  };
  this.MouseUp = function (e) {
    if (e.button == mouse.LEFT) {
      input.SHOOT = 0;
    }
  };
  this.TouchStart = function (e) {
    input.SHOOT = 1;
    input.START = 1;
  };
  this.TouchEnd = function (e) {
    input.SHOOT = 0;
    input.START = 0;
  };
  this.TouchMove = function (e) {};
}
function States() {
  var m_currentState = 0;
  var prevButton = 0;
  this.Init = function () {
    g_imageManager.Init();
    g_world.Init();
    g_context.fillStyle = "rgb(200,10,10)";
    g_context.font = "32px Lucida Handwriting";
    g_states.GameOver();
  };
  this.StartGame = function () {
    g_context.font = "32px Comic Sans MS";
    g_states.m_currentState = g_states.GameState;
    g_world.Reset();
  };
  this.GameOver = function () {
    g_states.m_currentState = g_states.GameOverState;
  };
  this.OpenMenu = function () {
    g_states.m_currentState = g_states.MenuState;
  };
  this.GameOverState = function () {
    g_context.drawImage(g_imageManager.m_backgroundImg, 0, 0);
    g_context.fillStyle = "rgb(200,10,10)";
    g_context.fillText(
      'Press "Enter" to continue...',
      DimViewCentral.x - 18 * 16,
      DimViewCentral.y - 64
    );
    g_context.fillText(
      'Press "Up" to Accelerate',
      DimViewCentral.x - 18 * 16,
      DimViewCentral.y
    );
    g_context.fillText(
      'Press "Left", "Right" to Rotate',
      DimViewCentral.x - 18 * 16,
      DimViewCentral.y + 32
    );
    g_context.fillText(
      'Press "Space" to Shoot',
      DimViewCentral.x - 18 * 16,
      DimViewCentral.y + 64
    );
    if (input.START) g_states.StartGame();
  };
  this.GameState = function () {
    g_world.Update();
  };
  this.MenuState = function () {
    g_context.drawImage(g_imageManager.m_backgroundImg, 0, 0);
  };
}

function World() {
  var m_physicsWorld = new PhysicsWorld();
  this.m_players = [];
  this.m_thiefs = [];
  this.m_diamonds = [];
  var m_controllers = [];
  var m_explosion = [];
  var m_level = 1;
  var m_currentThrsehold = 0;
  var m_score = 0;
  var m_round = 1;
  var m_phase = 0;
  var m_spawnTimer;
  var m_isSpawning;
  var m_diamondCount;
  var m_gameOver;
  this.count;
  this.Init = function () {
    this.count = 0;
    this.GenStars();
    m_physicsWorld.AddCollisionPair(Entity.PLAYER_SHIP, Entity.ENEMY_SHIP);
    m_physicsWorld.AddCollisionPair(Entity.PLAYER_SHIP, Entity.ENEMY_BULLET);
    m_physicsWorld.AddCollisionPair(Entity.PLAYER_BULLET, Entity.ENEMY_SHIP);
    m_physicsWorld.AddCollisionPair(Entity.DIAMOND, Entity.ENEMY_SHIP);
  };
  this.GenStars = function () {
    g_context.clearRect(0, 0, g_canvas.width, g_canvas.height);
    g_context.fillStyle = "black";
    g_context.fillRect(0, 0, DimView.right, DimView.bottom);
    g_context.fillStyle = "white";
    var starDist = 32;
    for (var y = 0; y < DimView.bottom; y += starDist) {
      for (var x = 0; x < DimView.right; x += starDist) {
        g_context.fillRect(x + Rand(0, starDist), y + Rand(0, starDist), 1, 1);
      }
    }
    g_imageManager.m_backgroundImg.src = g_canvas.toDataURL();
    g_context.clearRect(0, 0, g_canvas.width, g_canvas.height);
  };
  this.AddEntity = function (entity) {
    m_physicsWorld.AddPhysicsEntity(entity);
  };
  this.Reset = function () {
    this.count = 0;
    this.GenDiamond();
    m_level = 1;
    m_currentThrsehold = LEVELING[0];
    m_score = 0;
    m_round = 1;
    m_phase = 0;
    m_spawnTimer = 0;
    m_isSpawning = true;
    m_gameOver = false;
    var player = new GuardianShip();
    this.AddEntity(player);
    player.InitGuardianShip(
      DimView.right - SHIP_RADIUS,
      DimViewCentral.y,
      SHIP_RADIUS,
      g_imageManager.m_playerImg
    );
    this.m_players.push(player);
    player.Spawn();
    var controller = new P1Controller();
    controller.SetShip(player);
    m_controllers.push(controller);
  };
  this.GenDiamond = function () {
    m_diamondCount = 9;
    var step = DIAMOND_RADIUS * 2.5;
    var x = DimViewCentral.x - step * 1.5;
    var y = DimViewCentral.y - step * 1.5;
    for (var i = 0; i < m_diamondCount; i++) {
      var diamond = new Diamond();
      diamond.InitDiamond(
        x + (i % 3) * step,
        y + Math.floor(i / 3) * step,
        DIAMOND_RADIUS,
        g_imageManager.m_diamondImg
      );
      diamond.SetRotation(Rand(0, TWO_PI));
      this.m_diamonds.push(diamond);
      m_physicsWorld.AddPhysicsEntity(diamond);
    }
  };
  this.EndGame = function () {
    m_physicsWorld.Clear();
    for (var i = m_explosion.length; i--; ) m_explosion.pop();
    for (var i = this.m_thiefs.length; i--; ) this.m_thiefs.pop();
    for (var i = this.m_diamonds.length; i--; ) this.m_diamonds.pop();
    for (var i = this.m_players.length; i--; ) this.m_players.pop();
    for (var i = m_controllers.length; i--; ) m_controllers.pop();
  };
  this.Update = function () {
    this.DrawBackground();
    m_spawnTimer++;
    if (m_spawnTimer > SPAWN_RATE && this.m_thiefs.length == 0) {
      m_spawnTimer = 0;
      m_isSpawning = true;
    }
    if (m_isSpawning) {
      this.SpawnPhase();
    }
    for (var i = m_controllers.length; i--; ) m_controllers[i].OnUpdate();
    this.UpdateEntities(1);
    this.UpdateExplosion();
    if (m_gameOver) this.EndGame();
  };
  this.DrawBackground = function () {
    g_context.drawImage(g_imageManager.m_backgroundImg, 0, 0);
    g_context.fillText("Score " + m_score, 0, 32);
    g_context.fillText("Level " + m_level, 0, 64);
    g_context.fillText("Round " + m_round, 0, 96);
    g_context.fillText("Phase " + m_phase, 0, 128);
  };
  this.UpdateEntities = function (stepSize) {
    m_physicsWorld.OnUpdate(stepSize);
    for (var i = this.m_thiefs.length; i-- > 0; ) {
      if (!this.m_thiefs[i].QueryAlive()) {
        this.m_thiefs.splice(i, 1);
      }
    }
    for (var i = this.m_diamonds.length; i-- > 0; ) {
      if (!this.m_diamonds[i].QueryAlive()) {
        this.m_diamonds.splice(i, 1);
      }
    }
    for (var i = m_controllers.length; i--; ) {
      if (m_controllers[i].QueryDownStatus()) {
        m_controllers.splice(i, 1);
      }
    }
    if (this.m_diamonds.length == 0) {
      g_states.GameOver();
      m_gameOver = true;
    }
  };
  this.AddExplosion = function (x, y) {
    var explosion = new Explosion();
    explosion.InitExplosion(
      x,
      y,
      EXPLOSION_RADIUS,
      g_imageManager.m_explosionImg,
      Entity.EXPLOSION,
      5
    );
    m_explosion.push(explosion);
  };
  this.UpdateExplosion = function () {
    for (var i = m_explosion.length; i--; ) {
      var explosion = m_explosion[i];
      if (explosion.QueryAlive()) {
        explosion.Draw();
      } else {
        m_explosion.splice(i, 1);
      }
    }
  };
  this.SpawnPhase = function () {
    m_phase++;
    if (m_phase > PHASE_PER_ROUND) {
      m_phase = 1;
      m_round++;
    }
    var spawnX, spawnY;
    switch (Rand(0, 5)) {
      case 0:
        spawnX = DimView.left - SPAWN_OFFSET;
        spawnY = DimView.top - SPAWN_OFFSET;
        break;
      case 1:
        spawnX = DimViewCentral.x;
        spawnY = DimView.top - SPAWN_OFFSET;
        break;
      case 2:
        spawnX = DimView.right + SPAWN_OFFSET;
        spawnY = DimView.top - SPAWN_OFFSET;
        break;
      case 3:
        spawnX = DimView.left - SPAWN_OFFSET;
        spawnY = DimView.bottom + SPAWN_OFFSET;
        break;
      case 4:
        spawnX = DimViewCentral.x;
        spawnY = DimView.bottom + SPAWN_OFFSET;
        break;
      case 5:
        spawnX = DimView.right + SPAWN_OFFSET;
        spawnY = DimView.bottom + SPAWN_OFFSET;
        break;
    }
    var enemyCount = m_round + 1;
    var angle = (2 * PI) / enemyCount;
    for (var i = enemyCount; i-- > 0; ) {
      this.SpawnThief(
        spawnX + Math.cos(angle * i) * SHIP_RADIUS,
        spawnY + Math.sin(angle * i) * SHIP_RADIUS
      );
    }
    m_isSpawning = false;
  };
  this.SpawnThief = function (x, y) {
    var ship = new TheftShip();
    ship.InitTheftShip(x, y, SHIP_RADIUS, g_imageManager.m_thiefImg, m_level);
    ship.SetRotation(
      GetVectorAngle(ship.x, ship.y, DimViewCentral.x, DimViewCentral.y)
    );
    this.AddEntity(ship);
    this.m_thiefs.push(ship);
    var controller = new AIController();
    var behavior = Rand(0, 1);
    controller.InitAIController(ship, behavior, m_controllers.length);
    m_controllers.push(controller);
  };
  this.SpawnBullet = function (bulletType) {
    var bullet = new Bullet();
    bullet.InitBullet(
      0,
      0,
      BULLET_RADIUS,
      g_imageManager.m_bulletImg,
      bulletType
    );
    m_physicsWorld.AddPhysicsEntity(bullet);
    bullet.Sleep();
    return bullet;
  };
  this.Score = function () {
    m_score++;
    if (m_score == m_currentThrsehold) {
      m_currentThrsehold = LEVELING[m_level];
      m_level++;
    }
  };
}
