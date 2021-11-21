import { Alert, Button, Card, Collapse, Form, InputNumber, Modal, Row } from "antd"
import TextArea from "antd/lib/input/TextArea"
import { DiskModel, events, generateString, GridClient, MachineModel, MachinesModel, NetworkModel } from "grid3_client"
import { BackendStorageType } from "grid3_client/dist/es6/storage/backend"
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
            LEADER_PUBLIC_IP: params.ip,
            PUBLIC_KEY: params.public_key.trim()
        }

        machines.machines = [machine]
        machines.description = "caprover worker machine/node"

        const self = this
        const logsListener = (msg: any) => {
            let value

            if (msg instanceof Object) {
              value = ""
            }

            self.setState({isLoadingTitle: msg.toString()})
        }

        self.setState({isLoading: true, isLoadingTitle: "Deploying..."})
        events.addListener("logs", logsListener)

        try {
            // twin id and proxy url are set by the grid client
            const rmbClient = new HTTPMessageBusClient(0, "")
            // storeSecret is not used anyway, we use local storage here
            const gridClient = new GridClient(params.network, params.mnemonics.trim(), "test", rmbClient, "", BackendStorageType.localstorage)
            await gridClient.connect()

            const result = await gridClient.machines.deploy(machines)
            const ids = result.contracts.created.map((contract) => contract.contract_id)
            Modal.info({
                title: "Success",
                content: (
                    <div>
                        Deployed a worker node with contract ID(s) of: <b>{ids.join(", ")}</b>
                    </div>
                )
            })
        } catch (error: any) {
            // console.error(error)
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
            events.removeListener("logs", logsListener)
            self.setState({isLoading: false, isLoadingTitle: ""})
        }
    }
    componentDidMount() {
        this.getConfig()
    }

    render() {
        const gridConfig = this.state.gridConfig
        const joinInfo = this.state.joinInfo

        const deploy = async (values: Object) => {
            const params = Object.assign(joinInfo, gridConfig, values)
            await this.deployNode(params)
        }

        let content

        if (this.state.isLoading) {
            content = <CenteredSpinner title={this.state.isLoadingTitle}/>
        } else if (!gridConfig.mnemonics || !gridConfig.network) {
            content = (
                <Alert
                    type="warning"
                    showIcon={true}
                    message="Please complete grid configuration first (Settings -> Grid configuration)"
                />
            )
        } else {
            const defaults = Object.assign(defaultNodeValues, gridConfig)
            content = (
                <Form
                    name="deploynode"
                    labelCol={{ span: 3 }}
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
                        label="Memory size (MB)"
                        name="memory"
                        rules={[{ required: true, message: 'Please set memory size' }]}>
                            <InputNumber min={0} style = {{ width: '25%' }}/>
                    </Form.Item>
                    <div style={{ height: 20 }} />
                    <Form.Item
                        label="Disk size (GB)"
                        name="disk_size"
                        rules={[{ required: true, message: 'Please choose a node' }]}>
                            <InputNumber min={0} style = {{ width: '25%' }}/>
                    </Form.Item>
                    <div style={{ height: 20 }} />
                    <Form.Item
                        label="Public key"
                        name="public_key"
                        rules={[{ required: true, message: 'Please enter your public key to be able to access this node' }]}>
                        <TextArea></TextArea>
                    </Form.Item>
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
            )
        }

        return (
            <div>
                <Card
                    style={{ marginTop: 16 }}
                    type="inner"
                    title="Deploy a new node on Threefold grid">
                    { content }
                </Card>
            </div>
        )
    }
}
