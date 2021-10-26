import { Button, Form, Input, InputNumber, message, Row } from 'antd'
import React from 'react'
import Toaster from '../../utils/Toaster'
import ApiComponent from '../global/ApiComponent'
import CenteredSpinner from '../global/CenteredSpinner'
import ErrorRetry from '../global/ErrorRetry'

export default class GridConfig extends ApiComponent<
    {
        isMobile: boolean
    },
    {
        gridConfig: any
        isLoading: boolean
    }
> {
    constructor(props: any) {
        super(props)

        this.state = {
            isLoading: true,
            gridConfig: {},
        }
    }

    componentDidMount() {
        const self = this
        self.setState({ isLoading: true })
        this.apiManager
            .getGridConfig()
            .then(function (data: any) {
                self.setState({ gridConfig: data })
            })
            .catch(Toaster.createCatcher())
            .then(function () {
                self.setState({ isLoading: false })
            })
    }

    updateConfig(newConfig: any) {
        const self = this
        self.setState({ isLoading: true })

        this.apiManager
            .setGridConfig(
                newConfig
            ).then(() => {
                message.success("Saved!")
                self.setState({gridConfig: newConfig})
            })
            .catch(Toaster.createCatcher())
            .then(function () {
                self.setState({ isLoading: false })
            })
    }

    render() {
        const self = this
        if (self.state.isLoading) {
            return <CenteredSpinner />
        }

        let gridConfig = this.state.gridConfig

        if (!gridConfig) {
            return <ErrorRetry />
        }

        return (
            <Form
                name="gridconfig"
                labelCol={{ span: 2 }}
                wrapperCol={{ span: 26 }}
                initialValues={ gridConfig }
                onFinish={(values) => self.updateConfig(values)}
                autoComplete="off">
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
                    <Form.Item>
                        <Row justify="end">
                            <Button
                                type="primary"
                                htmlType="submit"
                                block={this.props.isMobile}>Save</Button>
                        </Row>
                    </Form.Item>
            </Form >
        )
    }
}
