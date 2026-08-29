---
title: 'Arista 802.1X: No Client IP in Accounting'
description: 'Why an Arista switch sends Framed-IP-Address 0.0.0.0 after a successful dot1x auth, and how address locking fixes it.'
pubDate: 'Aug 29 2026'
category: 'troubleshooting'
---

## 背景

用户 `user@example.com`（MAC: 0011.2233.4455）接入 Arista 交换机 `ASW-01`（EOS 4.31.1F），通过 EAPOL 认证成功（状态 SUCCESS），但后端（日志平台/xACL）看不到审计日志或审计日志中不带客户端 IP 地址。

## 网络拓扑

```
终端 (10.0.200.50) → Et6 → ASW-01 (ASW)
                          → Po1 → DSW (VxLAN/VLAN 200)
                                   → FreeRadius 10.0.10.11 / 10.0.10.12
                                   → DHCP 10.0.10.20
```

- 认证点：ASW（接入层交换机）
- 认证协议：802.1X（EAPOL）→ ISE → FreeRadius
- 用户 VLAN：200（Wired_Tier1）
- 用户 IP：10.0.200.50（DHCP 分配）
- 认证服务器组：radius-grp-a（10.0.10.11:1812, 10.0.10.12:1813）
- 计费服务器组：radius-grp-a（与认证相同）

## 交换机初始配置

### AAA

```
aaa authentication dot1x default group radius-grp-a
aaa accounting dot1x default start-stop group radius-grp-a
```

### dot1x（全局）

```
dot1x
   aaa unresponsive action traffic allow vlan 300
   mac based authentication delay 30 seconds
   radius av-pair service-type
   captive-portal url https://captive-portal.example.com/fixpage/cn ssl profile https
```

### Et6

```
interface Ethernet6
   description dot1x_enabled_port
   switchport access vlan 200
   spanning-tree portfast
   dot1x pae authenticator
   dot1x authentication failure action traffic allow vlan 300
   dot1x reauthentication
   dot1x port-control auto
   dot1x host-mode multi-host authenticated
   dot1x mac based authentication
   dot1x timeout quiet-period 30
```

### RADIUS

```
radius-server timeout 1
radius-server retransmit 1
radius-server deadtime 10
radius-server attribute 32 include-in-access-req format old
radius-server host 10.0.10.11 key 7 ...
radius-server host 10.0.10.12 key 7 ...
```

### 本地 ACL

```
ip access-list dev
   10 permit ip any any
ip access-list DEV
   10 permit ip any any
ip access-list NON
   10 permit ip any any
ip access-list NACROLE
   10 permit udp any any eq domain bootps bootpc
   20 permit tcp any any eq domain
   40 deny tcp any 10.0.0.0/8 eq www copy captive-portal
   50 deny tcp any 10.0.0.0/8 eq https copy captive-portal
   60 permit ip any any
```

## 认证与计费流程

### Arista 认证流程（两步式）

内部认证流程手册注明：第 5、6 步为 Arista 特有。

| 步骤 | 说明 |
|------|------|
| 1-4 | EAPOL → ISE → FreeRadius 认证 |
| 5 (Arista only) | ASW 携带 Filter-Id 再次发起 Radius-Request 请求授权 |
| 6 (Arista only) | ISE 根据 Filter-Id 下发 dVLAN/dACL 授权 |

认证完成后，如果 ASW 配置了 accounting，则发起 Accounting-Request。

### Arista Accounting 触发机制

```
认证事件          → Acct-Start
IP Locking 学 IP  → Interim-Update（事件驱动，非定时器）
重认证 (3600s)     → Acct-Stop + 新 Acct-Start
用户下线          → Acct-Stop
```

> **注意**: Arista EOS `aaa accounting dot1x default start-stop` 仅发送 Acct-Start 和 Acct-Stop。没有内置周期性定时器。Interim-Update 由 IP 学习事件触发，而非定时器。

### 与华为/思科的区别

| 厂商 | 配置 | 行为 |
|------|------|------|
| 华为 | `accounting realtime 3` | 每 3 分钟定时发 |
| 思科 | `aaa accounting update periodic 120` | 每 120 分钟定时发 |
| Arista | 无对应配置 | 无定时器，事件驱动 |

## 排查过程

### 阶段一：确认交换机认证状态

```
show dot1x hosts              → Et6 0011.2233.4455 EAPOL SUCCESS
show dot1x hosts mac ... detail → VLAN ID: (空)
                                   Framed-IP-Address: 0.0.0.0
                                   Accounting-Session-Id: 1x00000009
                                   Filter-Id: dev
                                   Service-Type: Unknown (4294967295) ← 0xFFFFFFFF
                                   Tunnel-Private-GroupId: (空)
```

**发现**: Service-Type 为垃圾值 `0xFFFFFFFF`，无动态 VLAN 下发。

### 阶段二：检查 AAA Accounting 配置

```
show running-config | include aaa
→ aaa accounting dot1x default start-stop group radius-grp-a  ← 存在，仅 start-stop
→ 无 aaa accounting update periodic                            ← 无周期性更新
```

### 阶段三：确认 RADIUS 计费统计

```
show radius
→ Accounting Starts: 10 (仅 10 次，全交换机累计)
→ Interim Updates:   8
→ Accounting Stops:  6
```

相比基线交换机 ASW-BASELINE：Acct-Start=1602, Interim=7036, Acct-Stop=1594

### 阶段四:对比基线交换机（ASW-BASELINE）

| 项目 | ASW-01 (问题) | ASW-BASELINE (基线) |
|------|---------------|---------------|
| EOS 版本 | 4.31.1F | 4.31.1F |
| 硬件 | CCS-720XP-48Y6-F | CCS-720XP-48Y6-F |
| auth dot1x | group radius-grp-a | group radius-grp-b |
| acct dot1x | group radius-grp-a | group coa-grp |
| DHCP snooping | disabled | disabled |
| aaa accounting update periodic | 未配 | 未配 |
| address locking | ✗ 未配 | ✓ 已配 |
| Service-Type | 0xFFFFFFFF | Framed-User |
| Tunnel-Private-GroupId | (空) | 1010 |

### 阶段五：关键差异——Address Locking

基线上发现关键配置：

```
address locking
   local-interface Vlan30
   dhcp server ipv4 10.0.10.20
   dhcp server ipv4 10.0.10.21
vlan 200
   address locking
      address-family ipv4
```

**Arista 不通过 DHCP snooping 学 IP，而是通过 IP Locking + DHCP Leasequery 向 DHCP 服务器主动查询。**

内部配置说明文档（Arista 交换机 802.1x 认证字段）原文：

> "由于交换机实现不同，Arista交换机无法直接获取到用户的IP地址信息。在802.1x认证及后续AAA交互过程中，也无法向radius服务器提供这些信息（Framed-IP-Address, Service-Type）。故xacl无法获取应有的用户信息。
>
> 由于认证点位于接入层交换机，Arista给出了其他解决办法让接入交换机能获取到IP信息，即IP locking功能，该功能可以向DHCP服务器请求地址分配情况。"

## 根因

**问题交换机 ASW-01 缺少 `address locking` 配置，导致交换机无法获取用户 IP 地址，accounting 报文中 `Framed-IP-Address` 始终为 `0.0.0.0`。**

此外：
- `aaa accounting dot1x default start-stop` 仅发 Start/Stop，不发周期性 Interim-Update
- 用户侧 FreeRadius（10.0.10.11）返回的 `Service-Type = 0xFFFFFFFF` 为无效值
- 无动态 VLAN 下发（`Tunnel-Private-GroupId` 为空），但不影响流量转发（回退到端口 access VLAN 200）

## 解决方案

### 方案一：DHCP Leasequery（推荐）

前提：DHCP 服务器需开启 leasequery（配置 DHCPv4 raw option: `allow leasequery;`）。

交换机配置：

```
address locking
   local-interface Vlan30
   dhcp server ipv4 <DHCP服务器IP>
vlan 200
   address locking
      address-family ipv4
interface Ethernet53/54 (上联口)
   address locking
      address-family ipv4 disabled
      address-family ipv6 disabled
```

效果：认证后交换机通过 leasequery 从 DHCP 服务器查询 IP → 事件触发 Interim-Update → 后端带 IP。

### 方案二：静态绑定（个别用户）

```
address locking
   local-interface Vlan30
   dhcp server ipv4 <DHCP服务器IP>     # 仍然需要，VLAN 级配置必须
   lease 10.x.x.x mac xx:xx:xx:xx:xx:xx
vlan 200
   address locking
      address-family ipv4
```

注意：静态绑定下 IP 在 Acct-Start 中即携带，但无 DHCP 学习事件触发后续 Interim-Update。如需周期性更新：

```
aaa accounting update periodic 3      # 每 3 分钟发一次
```

### 后续需关注的问题

1. **FreeRadius 属性修复**: `Service-Type = 0xFFFFFFFF` 需要联系 FreeRadius 团队修复为 `Framed-User`
2. **动态 VLAN**: 如需动态 VLAN，FreeRadius 需返回 `Tunnel-Private-Group-ID`
3. **IP Locking 注意事项**: 该功能也会检查终端 IP 合法性，可能会阻止非法终端

## 验证命令

```bash
# 基本诊断
show dot1x hosts                            # 查看认证终端
show dot1x hosts mac <mac> detail           # 查看终端详情（含 AAA 返回属性、IP）
show radius                                 # 查看 RADIUS 统计（验证计数变化）

# Address Locking
show address locking                        # 查看功能和 VLAN 状态
show address locking table ipv4             # 查看 lease 表

# 配置检查
show running-config | section address locking
show running-config | include aaa

# 日志
show logging | include DOT1X-6-SUPPLICANT_AUTHENTICATED
```

## 相关文档

- Arista 官方 dot1x 命令文档: https://www.arista.com/en/um-eos/eos-control-plane-security
