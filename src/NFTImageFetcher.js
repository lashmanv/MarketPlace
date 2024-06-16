import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Bonanza_abi } from './NFT_abi';
import { MarketPlace_abi } from './MarketPlace_abi';

const nftContractAddress = '0xe92Fd2c76a12C4342777fbf162963AD1d716E593';
const marketPlaceContractAddress = '0x47BFeD427A2fe5cC70347AD89D926fA6C733B24F';

const NFTImageFetcher = () => {
    const [signerAddress, setSignerAddress] = useState(null);
    const [nftContract, setNftContract] = useState(null);
    const [marketPlaceContract, setMarketPlaceContract] = useState(null);
    const [nfts, setNfts] = useState([]);
    const [assets, setAssets] = useState([]);
    const [error, setError] = useState('');

    useEffect(() => {
        const init = async () => {
            if (window.ethereum) {
                try {
                    await window.ethereum.request({ method: 'eth_requestAccounts' });
                    const provider = new ethers.providers.Web3Provider(window.ethereum);
                    const signer = provider.getSigner();
                    const contract1 = new ethers.Contract(nftContractAddress, Bonanza_abi, signer);
                    const contract2 = new ethers.Contract(marketPlaceContractAddress, MarketPlace_abi, signer);

                    setNftContract(contract1);
                    setMarketPlaceContract(contract2);

                    const address = await signer.getAddress();
                    setSignerAddress(address);
                } catch (error) {
                    console.error('Error connecting to Ethereum provider:', error);
                    setError('Error connecting to Ethereum provider. Please check your MetaMask and refresh the page.');
                }
            } else {
                setError('MetaMask is not installed');
            }
        };

        init();
    }, []);

    const fetchTokenURIs = async () => {
        if (nftContract && marketPlaceContract) {
            try {
                const ids = await marketPlaceContract.getListedTokenIds();
                const nftDataPromises = ids.map(async (id) => {
                    try {
                        const tokenId = id.toNumber(); // Convert BigNumber to number

                        let uri = await nftContract.tokenURI(tokenId);
                        uri = "https://gateway.pinata.cloud/ipfs/" + uri;
                        const response = await fetch(uri);

                        if (!response.ok) {
                            throw new Error(`HTTP error! Status: ${response.status}`);
                        }

                        const contentType = response.headers.get('content-type');
                        if (!contentType || !contentType.includes('application/json')) {
                            const errorText = await response.text();
                            throw new Error(`Expected JSON, got: ${contentType}\nResponse: ${errorText}`);
                        }

                        const metadata = await response.json();
                        const imageUri = metadata.image.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
                        const price = await fetchPrice(tokenId);
                        return { id: tokenId, imageUri, price };
                    } catch (fetchError) {
                        console.error(`Error fetching metadata for token ID ${id}: ${fetchError.message}`);
                        setError(`Error fetching metadata for token ID ${id}: ${fetchError.message}`);
                        return null; // Return null in case of an error
                    }
                });

                const nftData = await Promise.all(nftDataPromises);
                setNfts(nftData.filter(nft => nft !== null)); // Filter out null values
                setError('');
            } catch (contractError) {
                console.error(`Error fetching token URIs: ${contractError.message}`);
                setError(`Error fetching token URIs: ${contractError.message}`);
            }
        } else {
            setError('Contract instance not initialized.');
        }
    };

    const fetchPrice = async (id) => {
        if (marketPlaceContract) {
            try {
                const nftPrice = await marketPlaceContract.listings(id);
                return ethers.utils.formatEther(nftPrice.price); // Convert price to a readable format
            } catch (contractError) {
                console.error(`Error fetching token prices: ${contractError.message}`);
                setError(`Error fetching token prices: ${contractError.message}`);
            }
        } else {
            setError('MarketPlace contract instance not initialized.');
        }
    };

    const buyToken = async (id, price) => {
        if (marketPlaceContract) {
            try {
                const tx = await marketPlaceContract.buyToken(id, { value: ethers.utils.parseEther(price) });
                await tx.wait();
                alert('Purchase successful!');
            } catch (contractError) {
                console.error(`Error during purchase: ${contractError.message}`);
                setError(`Error during purchase: ${contractError.message}`);
            }
        } else {
            setError('MarketPlace contract instance not initialized.');
        }
    };

    const fetchAssets = async () => {
        if (nftContract && signerAddress) {
            try {
                console.log(signerAddress)
                const ids = await nftContract.tokensOfOwner(signerAddress);
                const assetDataPromises = ids.map(async (id) => {
                    try {
                        const tokenId = id.toNumber(); // Convert BigNumber to number

                        let uri = await nftContract.tokenURI(tokenId);
                        uri = "https://gateway.pinata.cloud/ipfs/" + uri;
                        const response = await fetch(uri);

                        if (!response.ok) {
                            throw new Error(`HTTP error! Status: ${response.status}`);
                        }

                        const contentType = response.headers.get('content-type');
                        if (!contentType || !contentType.includes('application/json')) {
                            const errorText = await response.text();
                            throw new Error(`Expected JSON, got: ${contentType}\nResponse: ${errorText}`);
                        }

                        const metadata = await response.json();
                        const imageUri = metadata.image.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
                        return { id: tokenId, imageUri };
                    } catch (fetchError) {
                        console.error(`Error fetching metadata for token ID ${id}: ${fetchError.message}`);
                        setError(`Error fetching metadata for token ID ${id}: ${fetchError.message}`);
                        return null; // Return null in case of an error
                    }
                });

                const assetData = await Promise.all(assetDataPromises);
                setAssets(assetData.filter(asset => asset !== null)); // Filter out null values
                setError('');
            } catch (contractError) {
                console.error(`Error fetching asset URIs: ${contractError.message}`);
                setError(`Error fetching asset URIs: ${contractError.message}`);
            }
        } else {
            setError('Contract instance not initialized or signer address not available.');
        }
    };

    useEffect(() => {
        fetchTokenURIs();
        fetchAssets();
    }, [nftContract, marketPlaceContract, signerAddress]);

    return (
        <>
            <div>
                <h1>NFT MARKETPLACE</h1>
                {error && <p style={{ color: 'red' }}>{error}</p>}
                <div>
                    {nfts.map((nft) => (
                        <div key={nft.id}>
                            <h2>Token ID: {nft.id}</h2>
                            <img src={nft.imageUri} alt={`NFT ${nft.id}`} />
                            <h2>Price: {nft.price ? `${nft.price} ETH` : 'Loading...'}</h2>
                            <button onClick={() => buyToken(nft.id, nft.price)}>BUY</button>
                        </div>
                    ))}
                </div>
            </div>
            <br />
            <br />
            <br />
            <div>
                <h1>MY NFTs</h1>
                {error && <p style={{ color: 'red' }}>{error}</p>}
                <div>
                    {assets.map((asset) => (
                        <div key={asset.id}>
                            <h2>Token ID: {asset.id}</h2>
                            <img src={asset.imageUri} alt={`NFT ${asset.id}`} />
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};

export default NFTImageFetcher;
