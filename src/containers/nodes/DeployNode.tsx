import { Alert, Button, Card, Collapse, Form, Input, InputNumber, Modal, Row } from "antd"
import TextArea from "antd/lib/input/TextArea"
import { DiskModel, generateString, GridClient, MachineModel, MachinesModel, NetworkModel } from "grid3_client"
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


const defaultNodeValues = {
    cpu: 1,
    memory: 2048,
    disk_size: 20
}

export default class DeployNode extends ApiComponent<
    {
        isMobile: boolean
        // deployNode: (provider: Provider) => void
    },
    {
        isLoading: boolean
        isLoadingTitle: string
        gridConfig: any,
        joinInfo: JoinInfo,
        // rmbClient: HTTPMessageBusClient

    }
> {
    constructor(props: any) {
        super(props)

        this.state = {
            isLoading: true,
            isLoadingTitle: "",
            gridConfig: {},
            joinInfo: {},
        }

    }

    getConfig() {
        const self = this
        self.setState({isLoading: true})

        const configPromise = self.apiManager.getGridConfig()
        // need to join as worker
        const joinInfoPromise = self.apiManager.getJoinInfo(false)


        Promise.all([configPromise, joinInfoPromise])
            .then((data: Array<any>) => {
                const [gridConfig, joinInfo] = data
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
        machines.name = `caprover_${generateString(20)}` // should be unique? because of deployment hash or local storage
        const network = new NetworkModel()
        // should generate a new name to prevent network updates which take more time
        // we can keep the same network name if we need newly added machines to be reachable from the same network
        network.name = `caprover_network_${generateString(10)}`
        network.ip_range = "10.200.0.0/16"
        machines.network = network

        const machine = new MachineModel()
        machine.cpu = params.cpu
        machine.memory = params.memory

        const disk0 = new DiskModel()
        disk0.name = "data0"
        disk0.size = params.disk_size
        disk0.mountpoint = "/var/lib/docker"
        machine.disks = [disk0]

        machine.node_id = params.node_id
        machine.public_ip = true
        machine.name = `caprover_worker_${generateString(20)}`
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

        const self = this
        self.setState({isLoading: true, isLoadingTitle: "Deploying..."})
        try {
            const result = await gridClient.machines.deploy(machines)
            const ids = result.contracts.created.map((contract) => contract.contract_id)
            Modal.info({
                title: "Success",
                content: (
                    <div>
                        Deployed a worker node with contract ID(s) of: <b>{ids.join(",")}</b>
                    </div>
                )
            })
        } catch (error: any) {
            const errorMessage = error.toString()
            Modal.error({
                title: "Error",
                content: (
                    <div>
                        An error occurred while trying to deploy a worker node: <br/>{errorMessage}
                    </div>
                )
            })
        } finally {
            self.setState({isLoading: false, isLoadingTitle: ""})
        }
    }

    componentDidMount() {
        this.getConfig()
    }

    render() {
        const gridConfig = this.state.gridConfig
        const joinInfo = this.state.joinInfo

        const deploy = (values: Object) => {
            let params  = Object.assign(values, joinInfo)

            if (!values.hasOwnProperty("twin_id")) {
                params = Object.assign(params, gridConfig)
            }

            this.deployNode(params)
        }

        if (this.state.isLoading) {
            return <CenteredSpinner title={this.state.isLoadingTitle}/>
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


        const defaults = Object.assign(defaultNodeValues, gridConfig)

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
                initialValues={ defaults }
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
                        <Input
                            min={0}
                            addonAfter="MB"
                            style = {{ width: '25%' }}/>
                    </Form.Item>
                    <div style={{ height: 20 }} />
                    <Form.Item
                        label="Disk size"
                        name="disk_size"
                        rules={[{ required: true, message: 'Please choose a node' }, { type: "number" }]}>
                        <Input
                            min={0}
                            addonAfter="GB"
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
}
