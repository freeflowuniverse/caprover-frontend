import { Alert, Button, Card, Form, InputNumber, Modal, Row, Select } from "antd"
import TextArea from "antd/lib/input/TextArea"
import { BackendStorageType, DiskModel, events, generateString, GridClient, MachineModel, MachinesModel, NetworkModel, Nodes } from "grid3_client"
import { HTTPMessageBusClient } from "ts-rmb-http-client"
import { IRegistryApi } from "../../models/IRegistryInfo"
import Toaster from '../../utils/Toaster'
import ApiComponent from '../global/ApiComponent'
import CenteredSpinner from '../global/CenteredSpinner'

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

const ROOT_FS_SIZE = 10 // GB

function getGridClient(params: any) {
    // twin id and proxy url are set by the grid client
    const rmbClient = new HTTPMessageBusClient(0, "")
    // storeSecret is not used anyway, we use local storage here
    const gridClient = new GridClient(params.network, params.mnemonics.trim(), params.store_secret, rmbClient, "", BackendStorageType.tfkvstore)


    window.onbeforeunload = () => {
        gridClient.disconnect()
    }

    return gridClient
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
        showModal: boolean,
        nodes: Array<number>;
        deployParams: any,
        registryInfo: IRegistryApi
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
            showModal: false,
            nodes: [],
            deployParams: {},
            registryInfo: {} as IRegistryApi,
        }

    }

    getConfig() {
        const self = this
        self.setState({isLoading: true})

        const configPromise = self.apiManager.getGridConfig()
        // need to join as worker
        const joinInfoPromise = self.apiManager.getJoinInfo(false)
        // need to make sure there's a default registery
        const registryPromise = self.apiManager.getDockerRegistries()

        Promise.all([configPromise, joinInfoPromise, registryPromise])
            .then((data: Array<any>) => {
                const [gridConfig, joinInfo, registryInfo] = data
                this.setState({gridConfig: gridConfig, joinInfo: joinInfo, registryInfo: registryInfo})

            })
            .catch(Toaster.createCatcher())
            .then(() => self.setState({isLoading: false}))
    }
    async deployNode(params: any) {
        const machines = new MachinesModel()

        // names can be generated then use list/get if needed
        machines.name = `cr${generateString(10)}` // should be unique? because of deployment hash or local storage
        const network = new NetworkModel()
        // should generate a new name to prevent network updates which take more time
        // we can keep the same network name if we need newly added machines to be reachable from the same network
        network.name = `crnet${generateString(10)}`
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
        machine.name = `crwrk${generateString(10)}`
        machine.planetary = false
        machine.flist = "https://hub.grid.tf/tf-official-apps/tf-caprover-main.flist"
        machine.qsfs_disks = []
        machine.rootfs_size = ROOT_FS_SIZE
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
            } else {
                value = msg.toString()
            }

            self.setState({isLoadingTitle: value})
        }

        self.setState({isLoading: true, isLoadingTitle: "Deploying..."})
        events.addListener("logs", logsListener)

        try {
            const gridClient = getGridClient(params)
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

        const findNodesClicked = async (values: any) => {
            this.setState({isLoading: true, isLoadingTitle: "Finding nodes with enough resources on the grid..."})

            const { rmbProxy, graphql} = getGridClient(gridConfig).getDefaultUrls(gridConfig.network as any)

            const gridNodes = new Nodes(graphql, rmbProxy)
            try {
                // filter options sizes are in GB
                const nodes = await gridNodes.filterNodes({
                    cru: values.cpu,
                    mru: values.memory / 1024,
                    sru: values.disk_size + ROOT_FS_SIZE,
                    publicIPs: true
                })

                if (nodes.length === 0) {
                    throw Error("Cannot find nodes with enough resources on the grid")
                } else {
                    this.setState({
                        nodes: nodes.map((node: any) => node.nodeId),
                        deployParams: values,
                    })
                    showModal()
                }

            } catch (error: any) {
                Modal.error({
                    title: "Error",
                    content: (
                        <div>{error.toString()}</div>
                    )
                })
            } finally {
                this.setState({isLoading: false, isLoadingTitle: ""})
            }
        }

        const deployClicked = async (values: any) => {
            hideModal()

            const deployParams = this.state.deployParams
            deployParams.node_id = values.node_id

            const params = Object.assign(joinInfo, gridConfig, deployParams)
            await this.deployNode(params)
        }

        const showModal = () => this.setState({showModal: true})
        const hideModal = () => this.setState({showModal: false})

        const nodes = this.state.nodes.map((nodeId: any) => (<Select.Option value={nodeId} key={nodeId}>({nodeId})</Select.Option> ))

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
        } else if (this.state.registryInfo.registries.length == 0) {
            content = (
                <Alert
                    type="warning"
                    message="No registries have been added yet. Go ahead and add your first registry from Cluster -> Docker Registry Configuration"
                />
            )
        } else {
            const defaults = Object.assign(defaultNodeValues, gridConfig)

            content = (
                <Form
                    name="deployconfigform"
                    labelCol={{ span: 3 }}
                    wrapperCol={{ span: 26 }}
                    initialValues={ defaults }
                    // onFinish={(values) => deploy(values)}
                    onFinish={findNodesClicked}
                    autoComplete="off">
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
                                block={this.props.isMobile}>Search resources...</Button>
                        </Row>
                    </Form.Item>
                </Form >
            )
        }


        const modal = (
            < Modal
            title ={`Please select from the following (${this.state.nodes.length}) node(s)`}
            visible = {this.state.showModal}
            destroyOnClose={true}
            footer={[
                <Button onClick={hideModal} key="cancel">
                    Cancel
                </Button>,

                <Button type="primary" form="deployform" key="submit" htmlType="submit">
                    Deploy
                </Button>
            ]}>
                <Form
                    id="deployform"
                    name="deployform"
                    labelCol={{ span: 4 }}
                    wrapperCol={{ span: 26 }}
                    autoComplete="off"
                    preserve={false}
                    onFinish={deployClicked}>
                    <Form.Item
                        label="Node ID"
                        name="node_id"
                        rules={[{ required: true, message: 'Please select a node' }]}>
                        <Select style = {{ width: '25%' }}>
                            {nodes}
                        </Select>
                    </Form.Item>
                </Form>
            </Modal >
        )

        return (
            <div >
                <Card
                    style={{ marginTop: 16 }}
                    type="inner"
                    title="Deploy a new node on Threefold grid">
                    { content }
                    { modal }
                </Card>
            </div >
        )
    }
}
