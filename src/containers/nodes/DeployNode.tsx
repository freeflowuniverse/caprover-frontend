import { Alert, Button, Card, Collapse, Form, Input, InputNumber, Row } from "antd"
import TextArea from "antd/lib/input/TextArea"
import { DiskModel, GridClient, MachineModel, MachinesModel, NetworkModel } from "grid3_client"
import { HTTPMessageBusClient } from "ts-rmb-http-client"
import Toaster from '../../utils/Toaster'
import ApiComponent from '../global/ApiComponent'
import CenteredSpinner from '../global/CenteredSpinner'

const { Panel } = Collapse


export enum Provider {
    THREEFOLD
}

interface JoinInfo {
    token?: string
    ip?: string
}

export default class DeployNode extends ApiComponent<
    {
        isMobile: boolean
        // deployNode: (provider: Provider) => void
    },
    {
        isLoading: boolean
        gridConfig: any,
        joinInfo: JoinInfo,
        // rmbClient: HTTPMessageBusClient

    }
> {
    constructor(props: any) {
        super(props)


        this.state = {
            isLoading: true,
            gridConfig: {},
            joinInfo: {},
        }

    }

    getConfig() {
        const self = this
        self.setState({isLoading: true})

        const configPromise = self.apiManager.getGridConfig()
        const joinInfoPromise = self.apiManager.getJoinInfo(true)


        Promise.all([configPromise, joinInfoPromise])
            .then((data: Array<any>) => {
                const [gridConfig, joinInfo] = data
                console.log(data)
                this.setState({gridConfig: gridConfig, joinInfo: joinInfo})

            })
            .catch(Toaster.createCatcher())
            .then(() => self.setState({isLoading: false}))
    }
    async deployNode(params: any) {
        const rmbClient = new HTTPMessageBusClient(params.twin_id, params.proxy_url)

        const gridClient = new GridClient(params.twin_id, params.url, params.mnemonics, rmbClient)
        const machines = new MachinesModel()

        // names can be generated then use list/get if needed
        machines.name = "caprover" // should be unique? because of deployment hash or local storage
        const network = new NetworkModel()
        // should generate a new name to prevent network updates which take more time
        // we can keep the same network name if we need newly added machines to be reachable from the same network
        network.name = "default"
        network.ip_range = "10.200.0.0/16"
        machines.network = network

        const machine = new MachineModel()
        machine.cpu = params.cpu
        machine.memory = params.memory

        const disk0 = new DiskModel()
        disk0.name = "data2"
        disk0.size = 20
        disk0.mountpoint = "/var/lib/docker"
        machine.disks = [disk0]

        machine.node_id = params.node_id // 2, 3, 7, 5 temp for now
        machine.public_ip = true
        machine.name = "caprover"
        machine.planetary = false
        machine.flist = "https://hub.grid.tf/samehabouelsaad.3bot/abouelsaad-caprover-tf_10.0.1_v1.0.flist"
        machine.qsfs_disks = []
        machine.rootfs_size = 10
        machine.entrypoint = "/sbin/zinit init"
        machine.env = {
            SWM_NODE_MODE: "worker",
            SWMTKN: params.token,
            LEADER_PUBLIC_IP: params.ip
        }

        machines.machines = [machine]
        machines.description = "caprover worker machine/node"
        gridClient.machines.deploy(machines)
    }

    componentDidMount() {
        this.getConfig()
    }

    render() {
        // TODO: show instruction to set grid config and hide the form if not set

        const gridConfig = this.state.gridConfig
        const joinInfo = this.state.joinInfo

        const deploy = (values: Object) => {
            let params  = Object.assign(values, joinInfo)

            if (!values.hasOwnProperty("twin_id")) {
                params = Object.assign(params, gridConfig)
            }

            console.log("deploying with", params)
            this.deployNode(params)
        }

        if (this.state.isLoading) {
            return <CenteredSpinner />
        }

        if (!gridConfig.twin_id || !gridConfig.mnemonics || !gridConfig.url || !gridConfig.proxy_url) {
            return (
                <div>
                    <Card
                        style={{ marginTop: 16 }}
                        type="inner"
                        title="Deploy a new node on Threefold grid">
                        <Alert
                            type="warning"
                            showIcon={true}
                            message="Please complete grid configuration first (Settings -> Grid configuration)"
                        />
                    </Card>
                </div>
            )
        }
        return (
            <div>
            <Card
                style={{ marginTop: 16 }}
                type="inner"
                title="Deploy a new node on Threefold grid"
            >
           <Form
                name="deploynode"
                labelCol={{ span: 2 }}
                wrapperCol={{ span: 26 }}
                initialValues={ gridConfig }
                onFinish={(values) => deploy(values)}
                autoComplete="off">
                    <Form.Item
                        label="Node ID"
                        name="node_id"
                        rules={[{ required: true, message: 'Please select a node' }, { type: "number" }]}>
                        <InputNumber
                            min={0}
                            style = {{ width: '25%' }}/>
                    </Form.Item>
                    <div style={{ height: 20 }} />
                    <Form.Item
                        label="CPU cores"
                        name="cpu"
                        rules={[{ required: true, message: 'Please set no. of CPU cores' }, { type: "number" }]}>
                        <InputNumber
                            min={0}
                            style = {{ width: '25%' }}/>
                    </Form.Item>
                    <div style={{ height: 20 }} />
                    <Form.Item
                        label="Memory size"
                        name="memory"
                        rules={[{ required: true, message: 'Please set memory size' }, { type: "number" }]}>
                        <InputNumber
                            min={0}
                            style = {{ width: '25%' }}/>
                    </Form.Item>
                    <div style={{ height: 20 }} />
                    <Form.Item
                        label="Disk size"
                        name="node_id"
                        rules={[{ required: true, message: 'Please choose a node' }, { type: "number" }]}>
                        <InputNumber
                            min={0}
                            style = {{ width: '25%' }}/>
                    </Form.Item>
                    <div style={{ height: 20 }} />
                    <Form.Item
                        label="Public key"
                        name="public_key"
                        rules={[{ required: true, message: 'Please enter your public key to be able to access this node' }]}>
                        <TextArea></TextArea>
                    </Form.Item>
                    <Collapse>
                        <Panel header="Grid configurations" key="1">
                            <Form.Item
                                label="Twin ID"
                                name="twin_id"
                                rules={[{ required: true, message: 'Please enter your twin ID!' }, { type: "number" }]}>
                                <InputNumber
                                    min={0}
                                    style = {{ width: '25%' }}/>
                            </Form.Item>
                            <div style={{ height: 20 }} />
                            <Form.Item
                                label="Mnemonics"
                                name="mnemonics"
                                rules={[{ required: true, message: 'Please enter your mnemonics!' }]}>
                                <Input.Password minLength={25}/>
                            </Form.Item>
                            <hr />
                            <div style={{ height: 20 }} />
                            <Form.Item
                                label="Explorer URL"
                                name="url"
                                rules={[{ required: true, message: 'Please choose a default explorer URL' }]}>
                                <Input type="url" minLength={10}/>
                            </Form.Item>
                            <div style={{ height: 20 }} />
                            <Form.Item
                                label="Proxy URL"
                                name="proxy_url"
                                rules={[{ required: true, message: 'Please choose a default proxy URL' }]}>
                            <Input type="url" minLength={10}/>
                            </Form.Item>
                            <div style={{ height: 40 }} />
                        </Panel>
                    </Collapse>
                    <div style={{ height: 20 }} />
                    <Form.Item>
                        <Row justify="end">
                            <Button
                                type="primary"
                                htmlType="submit"
                                block={this.props.isMobile}>Deploy</Button>
                        </Row>
                    </Form.Item>
            </Form >
            </Card>
            </div >
        )
    }
    // render() {
    //     const self = this
    //     const nodeToAdd = self.state.nodeToAdd

    //     return (
    //         <div>
    //             <Card
    //                 style={{ marginTop: 16 }}
    //                 type="inner"
    //                 title="Deploy a new node"
    //             >
    //                 <Row justify="space-between">
    //                     <Col lg={{ span: 11 }} xs={{ span: 24 }}>
    //                         <Input
    //                             style={{ marginBottom: 10 }}
    //                             addonBefore="New node IP Address"
    //                             placeholder="123.123.123.123"
    //                             type="text"
    //                             value={nodeToAdd.remoteNodeIpAddress}
    //                             onChange={(e) =>
    //                                 self.changeModel(
    //                                     'remoteNodeIpAddress',
    //                                     e.target.value
    //                                 )
    //                             }
    //                         />
    //                     </Col>
    //                     <Col lg={{ span: 11 }} xs={{ span: 24 }}>
    //                         <Input
    //                             style={{ marginBottom: 10 }}
    //                             addonBefore="CapRover IP Address"
    //                             placeholder="123.123.123.123"
    //                             type="text"
    //                             value={nodeToAdd.captainIpAddress}
    //                             onChange={(e) =>
    //                                 self.changeModel(
    //                                     'captainIpAddress',
    //                                     e.target.value
    //                                 )
    //                             }
    //                         />
    //                     </Col>
    //                     <Col span={24} style={{ marginTop: 10 }}>
    //                         <div style={{ paddingBottom: 5 }}>
    //                             &nbsp;SSH Private Key for <b>root</b>
    //                             &nbsp;
    //                             <Tooltip title="Use RSA key. Other types such as Ed25519 are not supported, for those use the alternative method below.">
    //                                 <InfoCircleOutlined
    //                                     style={{
    //                                         paddingTop: 8,
    //                                         paddingLeft: 8,
    //                                     }}
    //                                 />
    //                             </Tooltip>
    //                         </div>
    //                         <Input.TextArea
    //                             style={{ marginBottom: 20 }}
    //                             className="code-input"
    //                             rows={6}
    //                             placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;MIICWwIBAAKBgQDArfs81aizq8ckg16e+ewFgJg7J..."
    //                             value={nodeToAdd.privateKey}
    //                             onChange={(e) =>
    //                                 self.changeModel(
    //                                     'privateKey',
    //                                     e.target.value
    //                                 )
    //                             }
    //                         />
    //                     </Col>
    //                 </Row>
    //                 <Row justify="end">
    //                     <Radio.Group
    //                         defaultValue="a"
    //                         buttonStyle="outline"
    //                         style={{ marginBottom: 20 }}
    //                         value={nodeToAdd.nodeType}
    //                         onChange={(e) =>
    //                             self.changeModel('nodeType', e.target.value)
    //                         }
    //                     >
    //                         <Radio.Button value="worker">
    //                             Join as worker node
    //                         </Radio.Button>
    //                         <Radio.Button value="manager">
    //                             Join as manager node
    //                         </Radio.Button>
    //                     </Radio.Group>
    //                     &nbsp;
    //                     <Tooltip title="Tip: For every 5 workers, add 2 manager nodes, keeping manager node count as an odd number. Therefore, use worker node for the first 4 nodes you add to your cluster.">
    //                         <InfoCircleOutlined
    //                             style={{ paddingTop: 8, paddingLeft: 8 }}
    //                         />
    //                     </Tooltip>
    //                 </Row>

    //                 <Row justify="end">
    //                     <Col
    //                         lg={{ span: 6 }}
    //                         xs={{ span: 24 }}
    //                         style={{ maxWidth: 250 }}
    //                     >
    //                         <Input
    //                             addonBefore="SSH Port"
    //                             type="text"
    //                             value={nodeToAdd.sshPort}
    //                             onChange={(e) =>
    //                                 self.changeModel('sshPort', e.target.value)
    //                             }
    //                         />
    //                     </Col>
    //                     <Col
    //                         lg={{ span: 6 }}
    //                         xs={{ span: 24 }}
    //                         style={{ maxWidth: 250, marginLeft: 10 }}
    //                     >
    //                         <Tooltip title="Using non-root users with sudo access will NOT work. If you want to use a non-root account, it must be able run docker commands without sudo. Or simply use the alternative method below.">
    //                             <Input
    //                                 addonBefore="SSH User"
    //                                 type="text"
    //                                 value={nodeToAdd.sshUser}
    //                                 onChange={(e) =>
    //                                     self.changeModel(
    //                                         'sshUser',
    //                                         e.target.value
    //                                     )
    //                                 }
    //                             />
    //                         </Tooltip>
    //                     </Col>
    //                     <Button
    //                         style={{ marginLeft: 10 }}
    //                         type="primary"
    //                         block={this.props.isMobile}
    //                         // onClick={() =>
    //                         // //     self.props.onAddNodeClicked(
    //                         // //         self.state.nodeToAdd
    //                         // //     )
    //                         // // }
    //                     >
    //                         <ClusterOutlined /> &nbsp; Join Cluster
    //                     </Button>
    //                 </Row>
    //                 <div style={{ height: 50 }} />
    //                 <Collapse>
    //                     <Collapse.Panel header="Alternative Method" key="1">
    //                         <p>
    //                             CapRover uses SSH to connect to your nodes and
    //                             have them join the cluster. Sometimes, this
    //                             process does not work due to non standard SSH
    //                             configs such as custom ports, custom usernames,
    //                             and etc.
    //                         </p>
    //                         <p>
    //                             In these cases, it will be much simpler to run
    //                             the commands manually your self from an SSH
    //                             session. First, from your{' '}
    //                             <b>main leader node</b>, run the following
    //                             command:
    //                         </p>
    //                         <code>docker swarm join-token worker</code>

    //                         <p style={{ marginTop: 20 }}>
    //                             It will output something like this:
    //                         </p>
    //                         <code>
    //                             To add a worker to this swarm, run the following
    //                             command:
    //                             <br />
    //                             docker swarm join --token
    //                             SWMTKN-secret-token-here 127.0.0.1:2377
    //                         </code>
    //                         <p style={{ marginTop: 20 }}>
    //                             Then, copy the command from the output of above,
    //                             and simply from the worker node, run that
    //                             command.
    //                         </p>
    //                         <p style={{ marginTop: 20 }}>
    //                             Depending on your network configurations, you
    //                             may also need to append the command with{' '}
    //                             <code>
    //                                 {' '}
    //                                 --advertise-addr WORKER_EXTERNAL_IP:2377
    //                             </code>
    //                             . See{' '}
    //                             <a
    //                                 href="https://github.com/caprover/caprover/issues/572"
    //                                 target="_blank"
    //                                 rel="noopener noreferrer"
    //                             >
    //                                 {' '}
    //                                 this issue{' '}
    //                             </a>{' '}
    //                             for more details.
    //                         </p>
    //                     </Collapse.Panel>
    //                 </Collapse>
    //             </Card>
    //         </div>
    //     )
    // }
}
